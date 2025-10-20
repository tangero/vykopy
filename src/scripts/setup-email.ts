#!/usr/bin/env ts-node

/**
 * Email service setup and validation script
 * Run this script to validate email configuration and test the service
 */

import { emailService } from '../services/EmailService';
import { config } from '../config';

async function setupEmail(): Promise<void> {
  console.log('🚀 Setting up email service...\n');

  // 1. Validate configuration
  console.log('📋 Validating email configuration:');
  console.log(`   Host: ${config.email.host}`);
  console.log(`   Port: ${config.email.port}`);
  console.log(`   User: ${config.email.user}`);
  console.log(`   From: ${config.email.from}`);
  console.log(`   Password: ${config.email.pass ? '***configured***' : '❌ NOT SET'}\n`);

  if (!config.email.pass) {
    console.error('❌ SMTP password not configured. Please set SMTP_PASS environment variable.');
    process.exit(1);
  }

  // 2. Test SMTP connection
  console.log('🔌 Testing SMTP connection...');
  const isConnected = await emailService.verifyConnection();
  
  if (!isConnected) {
    console.error('❌ SMTP connection failed. Please check your configuration.');
    process.exit(1);
  }

  // 3. Test email configuration
  console.log('📧 Testing email configuration...');
  const testResult = await emailService.testConfiguration();
  
  if (testResult.success) {
    console.log('✅ Email service setup completed successfully!');
    console.log('\n📊 Queue status:', emailService.getQueueStatus());
  } else {
    console.error('❌ Email configuration test failed:', testResult.message);
    process.exit(1);
  }

  // 4. Graceful shutdown
  await emailService.shutdown();
  process.exit(0);
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupEmail().catch(error => {
    console.error('❌ Email setup failed:', error);
    process.exit(1);
  });
}

export { setupEmail };