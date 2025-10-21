import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/digikop_test',
});

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'regional_admin' | 'municipal_coordinator' | 'applicant';
  organization?: string;
}

export interface TestProject {
  id: string;
  name: string;
  applicant_id: string;
  state: string;
  start_date: string;
  end_date: string;
  geometry: any;
  work_type: string;
  work_category: string;
}

export const testUsers: TestUser[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'admin@digikop.cz',
    password: 'Admin123!',
    name: 'Regional Administrator',
    role: 'regional_admin',
    organization: 'Středočeský kraj'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'coordinator@praha.cz',
    password: 'Coord123!',
    name: 'Prague Coordinator',
    role: 'municipal_coordinator',
    organization: 'Praha'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    email: 'applicant@company.cz',
    password: 'Apply123!',
    name: 'Test Applicant',
    role: 'applicant',
    organization: 'Test Company s.r.o.'
  }
];

export const testProjects: TestProject[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440101',
    name: 'Test Excavation Project',
    applicant_id: '550e8400-e29b-41d4-a716-446655440003',
    state: 'draft',
    start_date: '2024-12-01',
    end_date: '2024-12-15',
    geometry: {
      type: 'Point',
      coordinates: [14.4378, 50.0755] // Prague coordinates
    },
    work_type: 'Výkop pro inženýrské sítě',
    work_category: 'utilities'
  }
];

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Clear existing test data
    await client.query('DELETE FROM project_comments WHERE project_id IN (SELECT id FROM projects WHERE applicant_id IN ($1, $2, $3))', 
      [testUsers[0].id, testUsers[1].id, testUsers[2].id]);
    await client.query('DELETE FROM projects WHERE applicant_id IN ($1, $2, $3)', 
      [testUsers[0].id, testUsers[1].id, testUsers[2].id]);
    await client.query('DELETE FROM user_territories WHERE user_id IN ($1, $2, $3)', 
      [testUsers[0].id, testUsers[1].id, testUsers[2].id]);
    await client.query('DELETE FROM users WHERE id IN ($1, $2, $3)', 
      [testUsers[0].id, testUsers[1].id, testUsers[2].id]);
    
    // Insert test users
    for (const user of testUsers) {
      // Hash password (simplified for testing)
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(user.password, 12);
      
      await client.query(`
        INSERT INTO users (id, email, password_hash, name, role, organization, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          organization = EXCLUDED.organization
      `, [user.id, user.email, hashedPassword, user.name, user.role, user.organization]);
    }
    
    // Assign territories to coordinator
    await client.query(`
      INSERT INTO user_territories (user_id, municipality_code, municipality_name)
      VALUES ($1, '554782', 'Praha')
      ON CONFLICT (user_id, municipality_code) DO NOTHING
    `, [testUsers[1].id]);
    
    // Insert test projects
    for (const project of testProjects) {
      await client.query(`
        INSERT INTO projects (
          id, name, applicant_id, state, start_date, end_date, 
          geometry, work_type, work_category, affected_municipalities
        )
        VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromGeoJSON($7), $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          state = EXCLUDED.state,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          geometry = EXCLUDED.geometry,
          work_type = EXCLUDED.work_type,
          work_category = EXCLUDED.work_category
      `, [
        project.id, project.name, project.applicant_id, project.state,
        project.start_date, project.end_date, JSON.stringify(project.geometry),
        project.work_type, project.work_category, ['Praha']
      ]);
    }
    
    await client.query('COMMIT');
    console.log('✅ Test data seeded successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to seed test data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase().catch(console.error);
}

export { seedDatabase };