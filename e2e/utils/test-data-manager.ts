import { Pool } from 'pg';
import { testConfig } from '../playwright.env';

export class TestDataManager {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: testConfig.database.url,
    });
  }

  async cleanupTestData() {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Clean up in correct order due to foreign key constraints
      await client.query('DELETE FROM audit_logs WHERE entity_type = $1', ['project']);
      await client.query('DELETE FROM project_comments');
      await client.query('DELETE FROM projects WHERE name LIKE $1', ['%Test%']);
      await client.query('DELETE FROM moratoriums WHERE name LIKE $1', ['%Test%']);
      await client.query('DELETE FROM user_territories WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await client.query('DELETE FROM users WHERE email LIKE $1 AND email NOT IN ($2, $3, $4)', 
        ['%test%', 'admin@digikop.cz', 'coordinator@praha.cz', 'applicant@company.cz']);
      
      await client.query('COMMIT');
      console.log('✅ Test data cleaned up');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to cleanup test data:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async createTestProject(data: {
    name: string;
    applicantId: string;
    state?: string;
    startDate?: string;
    endDate?: string;
    geometry?: any;
  }) {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO projects (
          name, applicant_id, state, start_date, end_date, 
          geometry, work_type, work_category, affected_municipalities
        )
        VALUES ($1, $2, $3, $4, $5, ST_GeomFromGeoJSON($6), $7, $8, $9)
        RETURNING id
      `, [
        data.name,
        data.applicantId,
        data.state || 'draft',
        data.startDate || '2024-12-01',
        data.endDate || '2024-12-15',
        JSON.stringify(data.geometry || { type: 'Point', coordinates: [14.4378, 50.0755] }),
        'Výkop pro inženýrské sítě',
        'utilities',
        ['Praha']
      ]);
      
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  async createTestMoratorium(data: {
    name: string;
    createdBy: string;
    validFrom?: string;
    validTo?: string;
    geometry?: any;
  }) {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO moratoriums (
          name, created_by, valid_from, valid_to, geometry, 
          reason, municipality_code
        )
        VALUES ($1, $2, $3, $4, ST_GeomFromGeoJSON($5), $6, $7)
        RETURNING id
      `, [
        data.name,
        data.createdBy,
        data.validFrom || '2024-12-01',
        data.validTo || '2025-06-01',
        JSON.stringify(data.geometry || { type: 'Point', coordinates: [14.4378, 50.0755] }),
        'road_reconstruction',
        '554782'
      ]);
      
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  async getTestUser(role: 'admin' | 'coordinator' | 'applicant') {
    const client = await this.pool.connect();
    
    try {
      const emailMap = {
        admin: 'admin@digikop.cz',
        coordinator: 'coordinator@praha.cz',
        applicant: 'applicant@company.cz'
      };
      
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [emailMap[role]]
      );
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}