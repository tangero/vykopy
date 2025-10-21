import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...');
  
  // Set up test database
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/digikop_test';
  
  try {
    // Run database migrations for test environment
    console.log('📊 Setting up test database...');
    execSync('npm run migrate', { stdio: 'inherit' });
    
    // Seed test data
    console.log('🌱 Seeding test data...');
    execSync('ts-node e2e/fixtures/seed-data.ts', { stdio: 'inherit' });
    
    console.log('✅ Global setup completed');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

export default globalSetup;