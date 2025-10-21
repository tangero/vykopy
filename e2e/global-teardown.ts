import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown...');
  
  try {
    // Clean up test database
    console.log('🗑️ Cleaning up test database...');
    // Note: In production, you might want to drop the test database here
    // For now, we'll just log the cleanup
    
    console.log('✅ Global teardown completed');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here to avoid masking test failures
  }
}

export default globalTeardown;