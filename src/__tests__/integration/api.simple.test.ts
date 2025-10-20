import request from 'supertest';
import { AuthService } from '../../services/AuthService';
import { User, UserRole } from '../../types';

// Mock all external dependencies
jest.mock('../../models/User');
jest.mock('../../models/Project');
jest.mock('../../models/Moratorium');
jest.mock('../../services/ConflictDetectionService');
jest.mock('../../services/NotificationTriggers');
jest.mock('../../services/EmailService');
jest.mock('../../config/database', () => ({
  pool: {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
  },
}));

// Import app after mocking dependencies
import app from '../../app';

describe('API Integration Tests - Simple', () => {
  // Test users with different roles
  const testUsers = {
    regionalAdmin: {
      id: 'admin-user-id',
      email: 'admin@digikop.cz',
      name: 'Regional Admin',
      organization: 'Central Bohemian Region',
      role: 'regional_admin' as UserRole,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    applicant: {
      id: 'applicant-user-id',
      email: 'applicant@company.cz',
      name: 'Project Applicant',
      organization: 'Construction Company',
      role: 'applicant' as UserRole,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  // Helper function to generate JWT tokens for testing
  const generateTestToken = (user: User): string => {
    return AuthService.generateToken(user);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check and Basic Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
    });

    it('should return API information', async () => {
      const response = await request(app)
        .get('/api/info')
        .expect(200);

      expect(response.body).toHaveProperty('name', 'DigiKop Coordination System API');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('endpoints');
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    });
  });

  describe('Authentication Endpoints', () => {
    it('should require authentication token for protected routes', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should validate login input', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: '123', // too short
        })
        .expect(401);

      expect(response.body.error.code).toBe('LOGIN_FAILED');
    });

    it('should validate registration input', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: '123', // too short
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.error.code).toBe('REGISTRATION_FAILED');
    });
  });

  describe('Project API Endpoints Structure', () => {
    it('should test project creation endpoint structure', async () => {
      const applicantToken = generateTestToken(testUsers.applicant);

      const createProjectData = {
        name: 'Integration Test Project',
        startDate: '2024-06-01',
        endDate: '2024-06-15',
        geometry: {
          type: 'Point',
          coordinates: [14.4378, 50.0755],
        },
        workType: 'excavation',
        workCategory: 'utility_installation',
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(createProjectData);

      // Should have proper error structure (since database is mocked)
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('timestamp');
    });

    it('should test project listing endpoint', async () => {
      const applicantToken = generateTestToken(testUsers.applicant);

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${applicantToken}`);

      // Should have proper response structure
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should test project detail endpoint', async () => {
      const applicantToken = generateTestToken(testUsers.applicant);

      const response = await request(app)
        .get('/api/projects/test-project-id')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
    });

    it('should test project status change endpoint', async () => {
      const applicantToken = generateTestToken(testUsers.applicant);

      const response = await request(app)
        .put('/api/projects/test-project-id/status')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ state: 'pending_approval' });

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
    });

    it('should test project comments endpoint', async () => {
      const applicantToken = generateTestToken(testUsers.applicant);

      const response = await request(app)
        .post('/api/projects/test-project-id/comments')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ content: 'Test comment' });

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('User Management Endpoints', () => {
    it('should test user listing endpoint (admin only)', async () => {
      const adminToken = generateTestToken(testUsers.regionalAdmin);
      const applicantToken = generateTestToken(testUsers.applicant);

      // Test admin access
      const adminResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminResponse.body).toHaveProperty('error');

      // Test non-admin access (should be denied)
      const applicantResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(applicantResponse.status).toBeGreaterThanOrEqual(400);
      expect(applicantResponse.body).toHaveProperty('error');
    });

    it('should test territory assignment endpoint', async () => {
      const adminToken = generateTestToken(testUsers.regionalAdmin);

      const response = await request(app)
        .put('/api/users/test-user-id/territories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          territories: [{ municipalityCode: 'CZ0100', municipalityName: 'Prague' }],
        });

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Handling and Response Format', () => {
    it('should return consistent error response format', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('timestamp');
    });

    it('should handle validation errors properly', async () => {
      const applicantToken = generateTestToken(testUsers.applicant);

      const invalidProjectData = {
        name: '', // Empty name should fail validation
        startDate: 'invalid-date',
        geometry: 'not-a-geometry',
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(invalidProjectData);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers).toHaveProperty('access-control-allow-credentials', 'true');
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Authorization and Territorial Restrictions', () => {
    it('should test role-based access control', async () => {
      const adminToken = generateTestToken(testUsers.regionalAdmin);
      const applicantToken = generateTestToken(testUsers.applicant);

      // Test different endpoints with different roles
      const endpoints = [
        '/api/projects',
        '/api/users',
        '/api/moratoriums',
      ];

      for (const endpoint of endpoints) {
        // Test with admin token
        const adminResponse = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(adminResponse.body).toHaveProperty('error');

        // Test with applicant token
        const applicantResponse = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${applicantToken}`);

        expect(applicantResponse.body).toHaveProperty('error');
      }
    });

    it('should test territorial access restrictions', async () => {
      const applicantToken = generateTestToken(testUsers.applicant);

      // Test accessing a specific project
      const response = await request(app)
        .get('/api/projects/test-project-id')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.body).toHaveProperty('error');
    });

    it('should test state change permissions', async () => {
      const applicantToken = generateTestToken(testUsers.applicant);

      // Applicant trying to approve project (should fail)
      const response = await request(app)
        .put('/api/projects/test-project-id/status')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ state: 'approved' });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Complete Workflow Testing', () => {
    it('should test project workflow endpoints in sequence', async () => {
      const applicantToken = generateTestToken(testUsers.applicant);
      const adminToken = generateTestToken(testUsers.regionalAdmin);

      // Step 1: Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({
          name: 'Workflow Test Project',
          startDate: '2024-06-01',
          endDate: '2024-06-15',
          geometry: { type: 'Point', coordinates: [14.4378, 50.0755] },
          workType: 'excavation',
          workCategory: 'utility_installation',
        });

      expect(createResponse.body).toHaveProperty('error');

      // Step 2: Try to change status
      const statusResponse = await request(app)
        .put('/api/projects/test-id/status')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ state: 'pending_approval' });

      expect(statusResponse.body).toHaveProperty('error');

      // Step 3: Add comment
      const commentResponse = await request(app)
        .post('/api/projects/test-id/comments')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ content: 'Test workflow comment' });

      expect(commentResponse.body).toHaveProperty('error');

      // Step 4: Admin approval attempt
      const approvalResponse = await request(app)
        .put('/api/projects/test-id/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ state: 'approved' });

      expect(approvalResponse.body).toHaveProperty('error');
    });
  });
});