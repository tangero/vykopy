// Environment configuration for E2E tests

export const testConfig = {
  // Test database configuration
  database: {
    url: process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/digikop_test',
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432'),
    database: process.env.TEST_DB_NAME || 'digikop_test',
    username: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || ''
  },

  // Application URLs
  app: {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:3001'
  },

  // Test timeouts
  timeouts: {
    default: 30000,
    navigation: 30000,
    action: 10000,
    expect: 10000
  },

  // Browser configuration
  browsers: {
    headless: process.env.CI === 'true',
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    devtools: process.env.DEVTOOLS === 'true'
  },

  // Test data configuration
  testData: {
    cleanup: process.env.CLEANUP_TEST_DATA !== 'false',
    seedData: process.env.SEED_TEST_DATA !== 'false'
  },

  // Performance thresholds
  performance: {
    pageLoadTime: 3000,
    apiResponseTime: 2000,
    mapLoadTime: 5000,
    conflictDetectionTime: 10000
  }
};

export default testConfig;