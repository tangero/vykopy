import { Request, Response, NextFunction } from 'express';
import { RBACMiddleware, AccessUtils } from '../middleware/rbac';
import { authenticateToken, requireRole, requireTerritorialAccess } from '../middleware/auth';
import { UserModel } from '../models/User';
import { User, UserRole } from '../types';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../models/User');
jest.mock('../config/database', () => ({
  pool: {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
  },
}));

const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('RBAC Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const mockUsers = {
    regionalAdmin: {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'Regional Admin',
      role: 'regional_admin' as UserRole,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    municipalCoordinator: {
      id: 'coordinator-id',
      email: 'coordinator@example.com',
      name: 'Municipal Coordinator',
      role: 'municipal_coordinator' as UserRole,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    applicant: {
      id: 'applicant-id',
      email: 'applicant@example.com',
      name: 'Applicant',
      role: 'applicant' as UserRole,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(() => {
    mockRequest = {
      headers: {},
      requestId: 'test-request-id',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('Authentication Token Middleware', () => {
    it('should reject request without authorization header', async () => {
      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', async () => {
      mockRequest.headers = { authorization: 'InvalidFormat' };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept valid token and set user in request', async () => {
      const token = jwt.sign(
        { userId: mockUsers.applicant.id, email: mockUsers.applicant.email, role: mockUsers.applicant.role },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );
      
      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockUserModel.findById.mockResolvedValue(mockUsers.applicant);

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockUsers.applicant);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject token when user not found in database', async () => {
      const token = jwt.sign(
        { userId: 'nonexistent-id', email: 'test@example.com', role: 'applicant' },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );
      
      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockUserModel.findById.mockResolvedValue(null);

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found or inactive',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow access for users with required role', () => {
      mockRequest.user = mockUsers.regionalAdmin;
      const middleware = requireRole(['regional_admin']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access for users with any of multiple required roles', () => {
      mockRequest.user = mockUsers.municipalCoordinator;
      const middleware = requireRole(['regional_admin', 'municipal_coordinator']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for users without required role', () => {
      mockRequest.user = mockUsers.applicant;
      const middleware = requireRole(['regional_admin']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this action',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated users', () => {
      const middleware = requireRole(['applicant']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Territorial Access Control', () => {
    it('should allow regional admin access to any territory', async () => {
      mockRequest.user = mockUsers.regionalAdmin;
      const middleware = requireTerritorialAccess('CZ0201');

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockUserModel.hasAccessToMunicipality).not.toHaveBeenCalled();
    });

    it('should allow municipal coordinator access to assigned territory', async () => {
      mockRequest.user = mockUsers.municipalCoordinator;
      mockUserModel.hasAccessToMunicipality.mockResolvedValue(true);
      const middleware = requireTerritorialAccess('CZ0201');

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockUserModel.hasAccessToMunicipality).toHaveBeenCalledWith(
        mockUsers.municipalCoordinator.id,
        'CZ0201'
      );
    });

    it('should deny municipal coordinator access to unassigned territory', async () => {
      mockRequest.user = mockUsers.municipalCoordinator;
      mockUserModel.hasAccessToMunicipality.mockResolvedValue(false);
      const middleware = requireTerritorialAccess('CZ0202');

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TERRITORIAL_ACCESS_DENIED',
          message: 'Access denied for this territory',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow applicant access (ownership check in route handlers)', async () => {
      mockRequest.user = mockUsers.applicant;
      const middleware = requireTerritorialAccess();

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated users', async () => {
      const middleware = requireTerritorialAccess('CZ0201');

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Enhanced RBAC Middleware', () => {
    it('should handle multiple municipality codes for territorial access', async () => {
      mockRequest.user = mockUsers.municipalCoordinator;
      mockUserModel.hasAccessToMunicipality
        .mockResolvedValueOnce(true)  // First municipality
        .mockResolvedValueOnce(true); // Second municipality

      const getMunicipalityCodes = jest.fn().mockResolvedValue(['CZ0201', 'CZ0202']);
      const middleware = RBACMiddleware.requireTerritorialAccess(getMunicipalityCodes);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockUserModel.hasAccessToMunicipality).toHaveBeenCalledTimes(2);
      expect(mockUserModel.hasAccessToMunicipality).toHaveBeenCalledWith(
        mockUsers.municipalCoordinator.id,
        'CZ0201'
      );
      expect(mockUserModel.hasAccessToMunicipality).toHaveBeenCalledWith(
        mockUsers.municipalCoordinator.id,
        'CZ0202'
      );
    });

    it('should deny access if coordinator lacks access to any municipality', async () => {
      mockRequest.user = mockUsers.municipalCoordinator;
      mockUserModel.hasAccessToMunicipality
        .mockResolvedValueOnce(true)   // First municipality - has access
        .mockResolvedValueOnce(false); // Second municipality - no access

      const getMunicipalityCodes = jest.fn().mockResolvedValue(['CZ0201', 'CZ0202']);
      const middleware = RBACMiddleware.requireTerritorialAccess(getMunicipalityCodes);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TERRITORIAL_ACCESS_DENIED',
          message: 'Access denied for municipality: CZ0202',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle ownership check for applicants', async () => {
      mockRequest.user = mockUsers.applicant;
      const getResourceOwnerId = jest.fn().mockResolvedValue(mockUsers.applicant.id);
      const middleware = RBACMiddleware.requireOwnership(getResourceOwnerId);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(getResourceOwnerId).toHaveBeenCalledWith(mockRequest);
    });

    it('should deny ownership access for non-owners', async () => {
      mockRequest.user = mockUsers.applicant;
      const getResourceOwnerId = jest.fn().mockResolvedValue('different-user-id');
      const middleware = RBACMiddleware.requireOwnership(getResourceOwnerId);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'OWNERSHIP_REQUIRED',
          message: 'You can only access your own resources',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow coordinators and admins to bypass ownership checks', async () => {
      mockRequest.user = mockUsers.municipalCoordinator;
      const getResourceOwnerId = jest.fn().mockResolvedValue('different-user-id');
      const middleware = RBACMiddleware.requireOwnership(getResourceOwnerId);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(getResourceOwnerId).not.toHaveBeenCalled(); // Should not check ownership for coordinators
    });
  });

  describe('Access Utilities', () => {
    it('should build territorial filter for regional admin', () => {
      const filter = AccessUtils.buildTerritorialFilter('admin-id', 'regional_admin');
      expect(filter).toBe(''); // No filter for regional admin
    });

    it('should build territorial filter for municipal coordinator', () => {
      const filter = AccessUtils.buildTerritorialFilter('coordinator-id', 'municipal_coordinator');
      expect(filter).toContain('user_territories');
      expect(filter).toContain('coordinator-id');
      expect(filter).toContain('affected_municipalities');
    });

    it('should build territorial filter for applicant', () => {
      const filter = AccessUtils.buildTerritorialFilter('applicant-id', 'applicant');
      expect(filter).toContain('applicant_id');
      expect(filter).toContain('applicant-id');
    });

    it('should deny access by default for unknown roles', () => {
      const filter = AccessUtils.buildTerritorialFilter('user-id', 'unknown' as UserRole);
      expect(filter).toBe('AND FALSE');
    });

    it('should check project access for different user roles', async () => {
      // Regional admin should have access
      let canAccess = await AccessUtils.canAccessProject('admin-id', 'project-id', 'regional_admin');
      expect(canAccess).toBe(true);

      // Municipal coordinator access depends on territory (mocked to return true)
      jest.spyOn(AccessUtils, 'getMunicipalityCodesFromProjectId').mockResolvedValue(['CZ0201']);
      mockUserModel.hasAccessToMunicipality.mockResolvedValue(true);
      
      canAccess = await AccessUtils.canAccessProject('coordinator-id', 'project-id', 'municipal_coordinator');
      expect(canAccess).toBe(true);

      // Applicant access depends on ownership (mocked to return false)
      canAccess = await AccessUtils.canAccessProject('applicant-id', 'project-id', 'applicant');
      expect(canAccess).toBe(false);
    });
  });

  describe('Error Handling in RBAC', () => {
    it('should handle database errors in territorial access check', async () => {
      mockRequest.user = mockUsers.municipalCoordinator;
      mockUserModel.hasAccessToMunicipality.mockRejectedValue(new Error('Database error'));
      
      const getMunicipalityCode = jest.fn().mockResolvedValue('CZ0201');
      const middleware = RBACMiddleware.requireTerritorialAccess(getMunicipalityCode);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TERRITORIAL_CHECK_FAILED',
          message: 'Failed to verify territorial access',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle errors in municipality code extraction', async () => {
      mockRequest.user = mockUsers.municipalCoordinator;
      
      const getMunicipalityCode = jest.fn().mockRejectedValue(new Error('Extraction error'));
      const middleware = RBACMiddleware.requireTerritorialAccess(getMunicipalityCode);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TERRITORIAL_CHECK_FAILED',
          message: 'Failed to verify territorial access',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle errors in ownership check', async () => {
      mockRequest.user = mockUsers.applicant;
      
      const getResourceOwnerId = jest.fn().mockRejectedValue(new Error('Ownership check error'));
      const middleware = RBACMiddleware.requireOwnership(getResourceOwnerId);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'OWNERSHIP_CHECK_FAILED',
          message: 'Failed to verify resource ownership',
          timestamp: expect.any(String),
          requestId: 'test-request-id',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});