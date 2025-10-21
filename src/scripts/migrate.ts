#!/usr/bin/env node

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migration...');
    
    // Check if PostGIS extension is available
    console.log('📍 Checking PostGIS extension...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
      await client.query('CREATE EXTENSION IF NOT EXISTS postgis_topology');
      console.log('✅ PostGIS extension enabled');
    } catch (error) {
      console.error('❌ Failed to enable PostGIS extension:', error);
      throw error;
    }

    // Verify PostGIS installation
    try {
      const result = await client.query('SELECT PostGIS_Version()');
      console.log(`✅ PostGIS version: ${result.rows[0].postgis_version}`);
    } catch (error) {
      console.error('❌ PostGIS verification failed:', error);
      throw error;
    }

    // Run the main migration script
    console.log('📋 Running database schema migration...');
    const migrationPath = join(__dirname, '../database/migrations/001_initial_schema.sql');
    
    try {
      const migrationSQL = readFileSync(migrationPath, 'utf8');
      await client.query(migrationSQL);
      console.log('✅ Database schema created successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }

    // Create spatial indexes for performance
    console.log('🔍 Creating spatial indexes...');
    const spatialIndexes = [
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_geometry_gist ON projects USING GIST(geometry)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moratoriums_geometry_gist ON moratoriums USING GIST(geometry)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_state_dates ON projects(state, start_date, end_date)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_applicant_state ON projects(applicant_id, state)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_municipalities ON projects USING GIN(affected_municipalities)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moratoriums_dates ON moratoriums(valid_from, valid_to)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_comments_project_id ON project_comments(project_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active ON users(role) WHERE is_active = true'
    ];

    for (const indexSQL of spatialIndexes) {
      try {
        await client.query(indexSQL);
        console.log(`✅ Created index: ${indexSQL.split(' ')[5]}`);
      } catch (error: any) {
        if (error.code === '42P07') {
          console.log(`ℹ️  Index already exists: ${indexSQL.split(' ')[5]}`);
        } else {
          console.warn(`⚠️  Failed to create index: ${error.message}`);
        }
      }
    }

    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'projects', 'moratoriums', 'project_comments', 'audit_logs', 'user_territories')
      ORDER BY table_name
    `);

    const expectedTables = ['audit_logs', 'moratoriums', 'project_comments', 'projects', 'user_territories', 'users'];
    const actualTables = tableCheck.rows.map(row => row.table_name).sort();

    if (JSON.stringify(expectedTables) === JSON.stringify(actualTables)) {
      console.log('✅ All required tables created successfully');
    } else {
      console.warn('⚠️  Some tables may be missing:');
      console.log('Expected:', expectedTables);
      console.log('Actual:', actualTables);
    }

    // Create default admin user if none exists
    console.log('👤 Checking for admin user...');
    const adminCheck = await client.query(
      "SELECT id FROM users WHERE role = 'regional_admin' LIMIT 1"
    );

    if (adminCheck.rows.length === 0) {
      console.log('👤 Creating default admin user...');
      const bcrypt = await import('bcrypt');
      const defaultPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);

      await client.query(`
        INSERT INTO users (email, password_hash, name, role, is_active)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        process.env.ADMIN_EMAIL || 'admin@digikop.cz',
        hashedPassword,
        'System Administrator',
        'regional_admin',
        true
      ]);

      console.log('✅ Default admin user created');
      console.log(`📧 Email: ${process.env.ADMIN_EMAIL || 'admin@digikop.cz'}`);
      console.log(`🔑 Password: ${defaultPassword}`);
      console.log('⚠️  Please change the default password after first login!');
    } else {
      console.log('✅ Admin user already exists');
    }

    console.log('🎉 Database migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await runMigration();
    console.log('✅ Migration process completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  main();
}

export { runMigration };