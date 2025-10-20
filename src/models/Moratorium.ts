import { Pool } from 'pg';
import { Moratorium, CreateMoratoriumRequest } from '../types';
import { createMoratoriumSchema } from '../validation/schemas';

export class MoratoriumModel {
  constructor(private db: Pool) {}

  /**
   * Creates a new moratorium
   */
  async create(data: CreateMoratoriumRequest, createdBy: string): Promise<Moratorium> {
    // Validate input data
    const validatedData = createMoratoriumSchema.parse(data);

    // Additional validation for maximum 5-year duration
    const validFrom = new Date(validatedData.validFrom);
    const validTo = new Date(validatedData.validTo);
    const maxValidTo = new Date(validFrom);
    maxValidTo.setFullYear(maxValidTo.getFullYear() + 5);

    if (validTo > maxValidTo) {
      throw new Error('Moratorium duration cannot exceed 5 years');
    }

    const query = `
      INSERT INTO moratoriums (
        name, geometry, reason, reason_detail, valid_from, valid_to, 
        exceptions, created_by, municipality_code
      ) VALUES ($1, ST_GeomFromGeoJSON($2), $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
        id, name, ST_AsGeoJSON(geometry)::json as geometry, reason, reason_detail,
        valid_from, valid_to, exceptions, created_by, municipality_code, created_at
    `;

    const values = [
      validatedData.name,
      JSON.stringify(validatedData.geometry),
      validatedData.reason,
      validatedData.reasonDetail || null,
      validatedData.validFrom,
      validatedData.validTo,
      validatedData.exceptions || null,
      createdBy,
      validatedData.municipalityCode
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToMoratorium(result.rows[0]);
  }

  /**
   * Gets a moratorium by ID
   */
  async findById(id: string): Promise<Moratorium | null> {
    const query = `
      SELECT 
        id, name, ST_AsGeoJSON(geometry)::json as geometry, reason, reason_detail,
        valid_from, valid_to, exceptions, created_by, municipality_code, created_at
      FROM moratoriums 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapRowToMoratorium(result.rows[0]) : null;
  }

  /**
   * Updates a moratorium
   */
  async update(id: string, data: Partial<CreateMoratoriumRequest>): Promise<Moratorium | null> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'geometry') {
          updateFields.push(`geometry = ST_GeomFromGeoJSON($${paramIndex})`);
          values.push(JSON.stringify(value));
        } else {
          // Convert camelCase to snake_case for database columns
          const dbColumn = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          updateFields.push(`${dbColumn} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const query = `
      UPDATE moratoriums 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, name, ST_AsGeoJSON(geometry)::json as geometry, reason, reason_detail,
        valid_from, valid_to, exceptions, created_by, municipality_code, created_at
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapRowToMoratorium(result.rows[0]) : null;
  }

  /**
   * Finds moratoriums with filters and pagination
   */
  async findMany(filters: {
    municipalityCode?: string;
    municipalityCodes?: string[];
    activeOnly?: boolean;
    validFrom?: string;
    validTo?: string;
    createdBy?: string;
    page?: number;
    limit?: number;
  }): Promise<{ moratoriums: Moratorium[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (filters.municipalityCode) {
      conditions.push(`municipality_code = $${paramIndex++}`);
      values.push(filters.municipalityCode);
    }

    if (filters.municipalityCodes && filters.municipalityCodes.length > 0) {
      conditions.push(`municipality_code = ANY($${paramIndex++})`);
      values.push(filters.municipalityCodes);
    }

    if (filters.activeOnly) {
      const today = new Date().toISOString().split('T')[0];
      conditions.push(`valid_from <= $${paramIndex} AND valid_to >= $${paramIndex}`);
      values.push(today);
      paramIndex++;
    }

    if (filters.validFrom) {
      conditions.push(`valid_to >= $${paramIndex++}`);
      values.push(filters.validFrom);
    }

    if (filters.validTo) {
      conditions.push(`valid_from <= $${paramIndex++}`);
      values.push(filters.validTo);
    }

    if (filters.createdBy) {
      conditions.push(`created_by = $${paramIndex++}`);
      values.push(filters.createdBy);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total records
    const countQuery = `SELECT COUNT(*) FROM moratoriums ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        id, name, ST_AsGeoJSON(geometry)::json as geometry, reason, reason_detail,
        valid_from, valid_to, exceptions, created_by, municipality_code, created_at
      FROM moratoriums 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const result = await this.db.query(query, values);
    const moratoriums = result.rows.map(row => this.mapRowToMoratorium(row));

    return { moratoriums, total };
  }

  /**
   * Deletes a moratorium
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM moratoriums WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Finds active moratoriums that intersect with given geometry
   */
  async findActiveIntersecting(geometry: GeoJSON.Geometry, date?: string): Promise<Moratorium[]> {
    const checkDate = date || new Date().toISOString().split('T')[0];
    
    const query = `
      SELECT 
        id, name, ST_AsGeoJSON(geometry)::json as geometry, reason, reason_detail,
        valid_from, valid_to, exceptions, created_by, municipality_code, created_at
      FROM moratoriums 
      WHERE valid_from <= $1 AND valid_to >= $1
      AND ST_Intersects(geometry, ST_GeomFromGeoJSON($2))
    `;

    const result = await this.db.query(query, [checkDate, JSON.stringify(geometry)]);
    return result.rows.map(row => this.mapRowToMoratorium(row));
  }

  /**
   * Finds moratoriums by municipality code
   */
  async findByMunicipality(municipalityCode: string, activeOnly: boolean = false): Promise<Moratorium[]> {
    let query = `
      SELECT 
        id, name, ST_AsGeoJSON(geometry)::json as geometry, reason, reason_detail,
        valid_from, valid_to, exceptions, created_by, municipality_code, created_at
      FROM moratoriums 
      WHERE municipality_code = $1
    `;

    const values: any[] = [municipalityCode];

    if (activeOnly) {
      const today = new Date().toISOString().split('T')[0];
      query += ' AND valid_from <= $2 AND valid_to >= $2';
      values.push(today);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToMoratorium(row));
  }

  /**
   * Checks if a geometry violates any active moratoriums
   */
  async checkViolations(geometry: GeoJSON.Geometry, startDate: string, endDate: string): Promise<Moratorium[]> {
    const query = `
      SELECT 
        id, name, ST_AsGeoJSON(geometry)::json as geometry, reason, reason_detail,
        valid_from, valid_to, exceptions, created_by, municipality_code, created_at
      FROM moratoriums 
      WHERE (
        (valid_from <= $1 AND valid_to >= $1) OR
        (valid_from <= $2 AND valid_to >= $2) OR
        (valid_from >= $1 AND valid_to <= $2)
      )
      AND ST_Intersects(geometry, ST_GeomFromGeoJSON($3))
    `;

    const result = await this.db.query(query, [startDate, endDate, JSON.stringify(geometry)]);
    return result.rows.map(row => this.mapRowToMoratorium(row));
  }

  /**
   * Validates moratorium duration (max 5 years)
   */
  static validateDuration(validFrom: string, validTo: string): boolean {
    const fromDate = new Date(validFrom);
    const toDate = new Date(validTo);
    const maxToDate = new Date(fromDate);
    maxToDate.setFullYear(maxToDate.getFullYear() + 5);

    return toDate <= maxToDate && toDate >= fromDate;
  }

  /**
   * Gets moratoriums expiring within specified days
   */
  async findExpiringSoon(days: number = 30, municipalityCodes?: string[]): Promise<Moratorium[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    let query = `
      SELECT 
        id, name, ST_AsGeoJSON(geometry)::json as geometry, reason, reason_detail,
        valid_from, valid_to, exceptions, created_by, municipality_code, created_at
      FROM moratoriums 
      WHERE valid_to BETWEEN $1 AND $2
    `;

    const values: any[] = [
      today.toISOString().split('T')[0],
      futureDate.toISOString().split('T')[0]
    ];

    if (municipalityCodes && municipalityCodes.length > 0) {
      query += ' AND municipality_code = ANY($3)';
      values.push(municipalityCodes);
    }

    query += ' ORDER BY valid_to ASC';

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToMoratorium(row));
  }

  /**
   * Checks if a project would violate any moratoriums with detailed information
   */
  async checkProjectViolations(
    geometry: GeoJSON.Geometry,
    startDate: string,
    endDate: string,
    municipalityCodes?: string[]
  ): Promise<{
    violations: Moratorium[];
    warnings: string[];
    canProceed: boolean;
  }> {
    let query = `
      SELECT 
        id, name, ST_AsGeoJSON(geometry)::json as geometry, reason, reason_detail,
        valid_from, valid_to, exceptions, created_by, municipality_code, created_at
      FROM moratoriums 
      WHERE (
        (valid_from <= $1 AND valid_to >= $1) OR
        (valid_from <= $2 AND valid_to >= $2) OR
        (valid_from >= $1 AND valid_to <= $2)
      )
      AND ST_Intersects(geometry, ST_GeomFromGeoJSON($3))
    `;

    const values: any[] = [startDate, endDate, JSON.stringify(geometry)];

    // Filter by municipality codes if provided
    if (municipalityCodes && municipalityCodes.length > 0) {
      query += ' AND municipality_code = ANY($4)';
      values.push(municipalityCodes);
    }

    const result = await this.db.query(query, values);
    const violations = result.rows.map(row => this.mapRowToMoratorium(row));

    const warnings: string[] = [];
    let canProceed = true;

    violations.forEach(moratorium => {
      const fromDate = moratorium.validFrom.toLocaleDateString('cs-CZ');
      const toDate = moratorium.validTo.toLocaleDateString('cs-CZ');
      
      warnings.push(
        `Projekt zasahuje do oblasti s moratoriem "${moratorium.name}" ` +
        `(platné od ${fromDate} do ${toDate}). Důvod: ${moratorium.reason}.`
      );

      if (moratorium.exceptions) {
        warnings.push(`Výjimky: ${moratorium.exceptions}`);
      }
    });

    // In Czech system, moratoriums are typically warnings, not hard blocks
    // Projects can still proceed but with warnings
    return {
      violations,
      warnings,
      canProceed: true // Allow proceeding with warnings
    };
  }

  /**
   * Gets active moratoriums for a specific area with buffer
   */
  async getActiveMoratoriumsInArea(
    geometry: GeoJSON.Geometry,
    bufferMeters: number = 0,
    date?: string
  ): Promise<Moratorium[]> {
    const checkDate = date || new Date().toISOString().split('T')[0];
    
    let geometryClause = 'ST_GeomFromGeoJSON($2)';
    if (bufferMeters > 0) {
      geometryClause = `ST_Buffer(ST_GeomFromGeoJSON($2), $3)`;
    }

    const query = `
      SELECT 
        id, name, ST_AsGeoJSON(geometry)::json as geometry, reason, reason_detail,
        valid_from, valid_to, exceptions, created_by, municipality_code, created_at
      FROM moratoriums 
      WHERE valid_from <= $1 AND valid_to >= $1
      AND ST_Intersects(geometry, ${geometryClause})
      ORDER BY valid_from DESC
    `;

    const values = bufferMeters > 0 
      ? [checkDate, JSON.stringify(geometry), bufferMeters]
      : [checkDate, JSON.stringify(geometry)];

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToMoratorium(row));
  }

  /**
   * Validates if a new moratorium overlaps with existing ones
   */
  async validateMoratoriumOverlap(
    geometry: GeoJSON.Geometry,
    validFrom: string,
    validTo: string,
    municipalityCode: string,
    excludeId?: string
  ): Promise<{
    hasOverlap: boolean;
    overlappingMoratoriums: Moratorium[];
    warnings: string[];
  }> {
    let query = `
      SELECT 
        id, name, ST_AsGeoJSON(geometry)::json as geometry, reason, reason_detail,
        valid_from, valid_to, exceptions, created_by, municipality_code, created_at
      FROM moratoriums 
      WHERE municipality_code = $1
      AND (
        (valid_from <= $2 AND valid_to >= $2) OR
        (valid_from <= $3 AND valid_to >= $3) OR
        (valid_from >= $2 AND valid_to <= $3)
      )
      AND ST_Intersects(geometry, ST_GeomFromGeoJSON($4))
    `;

    const values: any[] = [municipalityCode, validFrom, validTo, JSON.stringify(geometry)];

    if (excludeId) {
      query += ' AND id != $5';
      values.push(excludeId);
    }

    const result = await this.db.query(query, values);
    const overlappingMoratoriums = result.rows.map(row => this.mapRowToMoratorium(row));

    const warnings: string[] = [];
    if (overlappingMoratoriums.length > 0) {
      warnings.push(
        `Nové moratorium se překrývá s ${overlappingMoratoriums.length} existujícími omezeními:`
      );
      
      overlappingMoratoriums.forEach(moratorium => {
        const fromDate = moratorium.validFrom.toLocaleDateString('cs-CZ');
        const toDate = moratorium.validTo.toLocaleDateString('cs-CZ');
        warnings.push(`- ${moratorium.name} (${fromDate} - ${toDate})`);
      });
    }

    return {
      hasOverlap: overlappingMoratoriums.length > 0,
      overlappingMoratoriums,
      warnings
    };
  }

  /**
   * Gets moratorium statistics for a municipality
   */
  async getMoratoriumStatistics(municipalityCode: string): Promise<{
    total: number;
    active: number;
    expiringSoon: number; // within 30 days
    totalArea: number; // in square meters
  }> {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const future30Days = futureDate.toISOString().split('T')[0];

    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN valid_from <= $1 AND valid_to >= $1 THEN 1 END) as active,
        COUNT(CASE WHEN valid_to BETWEEN $1 AND $2 THEN 1 END) as expiring_soon,
        COALESCE(SUM(CASE WHEN valid_from <= $1 AND valid_to >= $1 THEN ST_Area(geometry::geography) END), 0) as total_area
      FROM moratoriums 
      WHERE municipality_code = $3
    `;

    const result = await this.db.query(query, [today, future30Days, municipalityCode]);
    const stats = result.rows[0];

    return {
      total: parseInt(stats.total) || 0,
      active: parseInt(stats.active) || 0,
      expiringSoon: parseInt(stats.expiring_soon) || 0,
      totalArea: parseFloat(stats.total_area) || 0
    };
  }

  /**
   * Maps database row to Moratorium interface
   */
  private mapRowToMoratorium(row: any): Moratorium {
    return {
      id: row.id,
      name: row.name,
      geometry: row.geometry,
      reason: row.reason,
      reasonDetail: row.reason_detail,
      validFrom: new Date(row.valid_from),
      validTo: new Date(row.valid_to),
      exceptions: row.exceptions,
      createdBy: row.created_by,
      municipalityCode: row.municipality_code,
      createdAt: new Date(row.created_at)
    };
  }
}