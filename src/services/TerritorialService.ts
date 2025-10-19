import { pool } from '../config/database';
import { UserModel } from '../models/User';
import { UserTerritory, User } from '../types';

export class TerritorialService {
  // Get all municipalities (placeholder - would come from a municipalities table)
  static async getAllMunicipalities(): Promise<{ code: string; name: string; orp?: string }[]> {
    // In a real implementation, this would query a municipalities table
    // For now, return some example Czech municipalities in Central Bohemian Region
    return [
      { code: 'CZ0201', name: 'Benešov', orp: 'Benešov' },
      { code: 'CZ0202', name: 'Beroun', orp: 'Beroun' },
      { code: 'CZ0203', name: 'Kladno', orp: 'Kladno' },
      { code: 'CZ0204', name: 'Kolín', orp: 'Kolín' },
      { code: 'CZ0205', name: 'Kutná Hora', orp: 'Kutná Hora' },
      { code: 'CZ0206', name: 'Mělník', orp: 'Mělník' },
      { code: 'CZ0207', name: 'Mladá Boleslav', orp: 'Mladá Boleslav' },
      { code: 'CZ0208', name: 'Nymburk', orp: 'Nymburk' },
      { code: 'CZ0209', name: 'Praha-východ', orp: 'Brandýs nad Labem-Stará Boleslav' },
      { code: 'CZ020A', name: 'Praha-západ', orp: 'Černošice' },
      { code: 'CZ020B', name: 'Příbram', orp: 'Příbram' },
      { code: 'CZ020C', name: 'Rakovník', orp: 'Rakovník' },
    ];
  }

  // Get municipalities by ORP (Municipality with Extended Competence)
  static async getMunicipalitiesByORP(orpName: string): Promise<{ code: string; name: string }[]> {
    const allMunicipalities = await this.getAllMunicipalities();
    return allMunicipalities
      .filter(m => m.orp === orpName)
      .map(m => ({ code: m.code, name: m.name }));
  }

  // Assign territories to multiple users (bulk operation)
  static async bulkAssignTerritories(assignments: {
    userId: string;
    territories: Omit<UserTerritory, 'userId'>[];
  }[]): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const assignment of assignments) {
        await UserModel.assignTerritories(assignment.userId, assignment.territories);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get all users with their territories
  static async getUsersWithTerritories(): Promise<Array<User & { territories: UserTerritory[] }>> {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          u.id, u.email, u.name, u.organization, u.role, u.is_active, u.created_at, u.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'userId', ut.user_id,
                'municipalityCode', ut.municipality_code,
                'municipalityName', ut.municipality_name
              )
            ) FILTER (WHERE ut.user_id IS NOT NULL),
            '[]'::json
          ) as territories
        FROM users u
        LEFT JOIN user_territories ut ON u.id = ut.user_id
        WHERE u.is_active = true
        GROUP BY u.id, u.email, u.name, u.organization, u.role, u.is_active, u.created_at, u.updated_at
        ORDER BY u.name
      `;
      
      const result = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Get territorial coverage report
  static async getTerritorialCoverageReport(): Promise<{
    totalMunicipalities: number;
    coveredMunicipalities: number;
    uncoveredMunicipalities: string[];
    coordinatorCount: number;
    territoriesPerCoordinator: { [userId: string]: number };
  }> {
    const client = await pool.connect();
    
    try {
      const allMunicipalities = await this.getAllMunicipalities();
      
      // Get covered municipalities
      const coveredQuery = `
        SELECT DISTINCT municipality_code, municipality_name
        FROM user_territories ut
        JOIN users u ON ut.user_id = u.id
        WHERE u.is_active = true AND u.role = 'municipal_coordinator'
      `;
      const coveredResult = await client.query(coveredQuery);
      const coveredCodes = new Set(coveredResult.rows.map(row => row.municipality_code));
      
      // Get coordinator count and territories per coordinator
      const coordinatorQuery = `
        SELECT 
          u.id,
          u.name,
          COUNT(ut.municipality_code) as territory_count
        FROM users u
        LEFT JOIN user_territories ut ON u.id = ut.user_id
        WHERE u.is_active = true AND u.role = 'municipal_coordinator'
        GROUP BY u.id, u.name
      `;
      const coordinatorResult = await client.query(coordinatorQuery);
      
      const territoriesPerCoordinator: { [userId: string]: number } = {};
      coordinatorResult.rows.forEach(row => {
        territoriesPerCoordinator[row.id] = parseInt(row.territory_count);
      });
      
      // Find uncovered municipalities
      const uncoveredMunicipalities = allMunicipalities
        .filter(m => !coveredCodes.has(m.code))
        .map(m => `${m.name} (${m.code})`);
      
      return {
        totalMunicipalities: allMunicipalities.length,
        coveredMunicipalities: coveredCodes.size,
        uncoveredMunicipalities,
        coordinatorCount: coordinatorResult.rows.length,
        territoriesPerCoordinator,
      };
    } finally {
      client.release();
    }
  }

  // Validate municipality codes
  static async validateMunicipalityCodes(codes: string[]): Promise<{
    valid: string[];
    invalid: string[];
  }> {
    const allMunicipalities = await this.getAllMunicipalities();
    const validCodes = new Set(allMunicipalities.map(m => m.code));
    
    const valid = codes.filter(code => validCodes.has(code));
    const invalid = codes.filter(code => !validCodes.has(code));
    
    return { valid, invalid };
  }

  // Get territorial conflicts (municipalities assigned to multiple coordinators)
  static async getTerritorialConflicts(): Promise<Array<{
    municipalityCode: string;
    municipalityName: string;
    assignedCoordinators: Array<{ id: string; name: string; email: string }>;
  }>> {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          ut.municipality_code,
          ut.municipality_name,
          json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email
            )
          ) as coordinators
        FROM user_territories ut
        JOIN users u ON ut.user_id = u.id
        WHERE u.is_active = true AND u.role = 'municipal_coordinator'
        GROUP BY ut.municipality_code, ut.municipality_name
        HAVING COUNT(DISTINCT u.id) > 1
        ORDER BY ut.municipality_name
      `;
      
      const result = await client.query(query);
      
      return result.rows.map(row => ({
        municipalityCode: row.municipality_code,
        municipalityName: row.municipality_name,
        assignedCoordinators: row.coordinators,
      }));
    } finally {
      client.release();
    }
  }

  // Remove territorial conflicts by keeping only the first coordinator
  static async resolveTerritorialConflicts(): Promise<number> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Find conflicts and resolve by keeping the coordinator with the earliest assignment
      const query = `
        DELETE FROM user_territories ut1
        WHERE EXISTS (
          SELECT 1 FROM user_territories ut2
          JOIN users u2 ON ut2.user_id = u2.id
          WHERE ut2.municipality_code = ut1.municipality_code
          AND ut2.user_id < ut1.user_id
          AND u2.is_active = true
          AND u2.role = 'municipal_coordinator'
        )
      `;
      
      const result = await client.query(query);
      
      await client.query('COMMIT');
      return result.rowCount || 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}