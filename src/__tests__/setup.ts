// Jest setup file for DigiKop tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'postgresql://localhost:5432/digikop_test';

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock isomorphic-dompurify to avoid ESM issues in tests
jest.mock('isomorphic-dompurify', () => {
  return {
    sanitize: (dirty: string) => dirty,
  };
});

// Mock the database pool for tests that import routes/app
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({
      rows: [{ health_check: 1, timestamp: new Date() }],
      rowCount: 1,
    }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn(),
    }),
    end: jest.fn(),
  },
  testConnection: jest.fn().mockResolvedValue(undefined),
  initializePostGIS: jest.fn().mockResolvedValue(undefined),
  closeDatabase: jest.fn().mockResolvedValue(undefined),
}));

// Mock email service
jest.mock('../services/EmailService', () => ({
  emailService: {
    verifyConnection: jest.fn().mockResolvedValue(true),
    sendEmail: jest.fn().mockResolvedValue(true),
  },
}));

// This file is just setup, no tests needed
export {};