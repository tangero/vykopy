import { Router, Request, Response } from 'express';
import { UserModel } from '../models/User';
import { updateUserSchema, assignTerritoriesSchema } from '../validation/schemas';
import { authenticateToken } from '../middleware/auth';
import { requireRegionalAdmin } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();

// All user routes require authentication
router.use(authenticateToken);

// GET /api/users - List all users (admin only)
router.get('/', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, isActive, page, limit } = req.query;
    
    const filters = {
      role: role as UserRole | undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    };

    const result = await UserModel.findAll(filters);
    
    res.json({
      success: true,
      data: {
        users: result.users,
        pagination: {
          total: result.total,
          page: filters.page,
          limit: filters.limit,
          totalPages: Math.ceil(result.total / filters.limit),
        },
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve users',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// GET /api/users/:id - Get specific user (admin only)
router.get('/:id', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }
    
    const user = await UserModel.findById(id);
    
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Get user territories if applicable
    let territories: any[] = [];
    if (user.role === 'municipal_coordinator') {
      territories = await UserModel.getUserTerritories(user.id);
    }

    res.json({
      success: true,
      data: {
        user,
        territories,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve user',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }
    
    // Validate request body
    const validatedData = updateUserSchema.parse(req.body);
    
    // Check if user exists
    const existingUser = await UserModel.findById(id);
    if (!existingUser) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Update user
    const updatedUser = await UserModel.update(id, {
      name: validatedData.name,
      organization: validatedData.organization,
      role: validatedData.role,
      isActive: validatedData.isActive,
    });

    if (!updatedUser) {
      res.status(500).json({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update user',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user: updatedUser,
        message: 'User updated successfully',
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update user',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// DELETE /api/users/:id - Deactivate user (admin only)
router.delete('/:id', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }
    
    // Check if user exists
    const existingUser = await UserModel.findById(id);
    if (!existingUser) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Prevent self-deletion
    if (req.user && req.user.id === id) {
      res.status(400).json({
        error: {
          code: 'SELF_DELETION_NOT_ALLOWED',
          message: 'Cannot delete your own account',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Soft delete user
    const success = await UserModel.delete(id);
    
    if (!success) {
      res.status(500).json({
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete user',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete user',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// PUT /api/users/:id/territories - Assign territories to user (admin only)
router.put('/:id/territories', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }
    
    // Validate request body
    const validatedData = assignTerritoriesSchema.parse(req.body);
    
    // Check if user exists and is a municipal coordinator
    const user = await UserModel.findById(id);
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    if (user.role !== 'municipal_coordinator') {
      res.status(400).json({
        error: {
          code: 'INVALID_USER_ROLE',
          message: 'Territories can only be assigned to municipal coordinators',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Assign territories
    await UserModel.assignTerritories(id, validatedData.territories);
    
    // Get updated territories
    const updatedTerritories = await UserModel.getUserTerritories(id);

    res.json({
      success: true,
      data: {
        territories: updatedTerritories,
        message: 'Territories assigned successfully',
      },
    });
  } catch (error) {
    console.error('Assign territories error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to assign territories',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// GET /api/users/:id/territories - Get user territories (admin only)
router.get('/:id/territories', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }
    
    // Check if user exists
    const user = await UserModel.findById(id);
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Get user territories
    const territories = await UserModel.getUserTerritories(id);

    res.json({
      success: true,
      data: {
        territories,
      },
    });
  } catch (error) {
    console.error('Get user territories error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve user territories',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// GET /api/users/pending - Get users pending approval (admin only)
router.get('/pending/approval', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    // Get inactive users (newly registered users waiting for approval)
    const result = await UserModel.findAll({
      isActive: false,
      page: 1,
      limit: 100,
    });
    
    res.json({
      success: true,
      data: {
        users: result.users,
        total: result.total,
      },
    });
  } catch (error) {
    console.error('Get pending users error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve pending users',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// PUT /api/users/:id/approve - Approve user registration (admin only)
router.put('/:id/approve', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!id) {
      res.status(400).json({
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }
    
    // Check if user exists (including inactive users)
    const user = await UserModel.findById(id);
    if (!user) {
      // Also check inactive users for approval
      const inactiveUser = await UserModel.findAll({ isActive: false });
      const foundUser = inactiveUser.users.find(u => u.id === id);
      
      if (!foundUser) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found or already active',
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
        return;
      }
    }

    // Activate user and optionally set role
    const updatedUser = await UserModel.update(id, {
      isActive: true,
      role: role || 'applicant',
    });

    if (!updatedUser) {
      res.status(500).json({
        error: {
          code: 'APPROVAL_FAILED',
          message: 'Failed to approve user',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user: updatedUser,
        message: 'User approved successfully',
      },
    });
  } catch (error) {
    console.error('Approve user error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to approve user',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

export default router;