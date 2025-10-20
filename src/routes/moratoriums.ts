import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { MoratoriumModel } from '../models/Moratorium';
import { authenticateToken } from '../middleware/auth';
import { RBACMiddleware } from '../middleware/rbac';
import { createMoratoriumSchema } from '../validation/schemas';
import { notificationTriggers } from '../services/NotificationTriggers';

const router = Router();

// Initialize services
let moratoriumModel: MoratoriumModel;

export const initializeMoratoriumRoutes = (db: Pool) => {
  moratoriumModel = new MoratoriumModel(db);
};

// GET /api/moratoriums - List moratoriums with filters
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      municipalityCode,
      activeOnly = 'false',
      validFrom,
      validTo,
      page = '1',
      limit = '20'
    } = req.query;

    const filters: any = {
      page: parseInt(page as string),
      limit: Math.min(parseInt(limit as string), 100)
    };

    if (municipalityCode) filters.municipalityCode = municipalityCode as string;
    if (activeOnly === 'true') filters.activeOnly = true;
    if (validFrom) filters.validFrom = validFrom as string;
    if (validTo) filters.validTo = validTo as string;

    // Apply territorial restrictions for municipal coordinators
    if (req.user?.role === 'municipal_coordinator' && req.user.id) {
      // Get user's territories and filter moratoriums
      const userTerritories = await getUserTerritories(req.user.id);
      filters.municipalityCodes = userTerritories.map(t => t.municipalityCode);
    }

    const result = await moratoriumModel.findMany(filters);

    res.json({
      success: true,
      data: {
        moratoriums: result.moratoriums,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / filters.limit)
        }
      }
    });
  } catch (error) {
    console.error('Get moratoriums error:', error);
    res.status(500).json({
      error: {
        code: 'FETCH_MORATORIUMS_FAILED',
        message: 'Failed to fetch moratoriums',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// GET /api/moratoriums/active - Get currently active moratoriums
router.get('/active', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { municipalityCode } = req.query;

    const filters: any = { activeOnly: true };

    if (municipalityCode) {
      filters.municipalityCode = municipalityCode as string;
    }

    // Apply territorial restrictions for municipal coordinators
    if (req.user?.role === 'municipal_coordinator' && req.user.id) {
      const userTerritories = await getUserTerritories(req.user.id);
      filters.municipalityCodes = userTerritories.map(t => t.municipalityCode);
    }

    const result = await moratoriumModel.findMany(filters);

    res.json({
      success: true,
      data: {
        moratoriums: result.moratoriums,
        count: result.total
      }
    });
  } catch (error) {
    console.error('Get active moratoriums error:', error);
    res.status(500).json({
      error: {
        code: 'FETCH_ACTIVE_MORATORIUMS_FAILED',
        message: 'Failed to fetch active moratoriums',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// GET /api/moratoriums/:id - Get moratorium by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Moratorium ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }
    
    const moratorium = await moratoriumModel.findById(id);

    if (!moratorium) {
      res.status(404).json({
        error: {
          code: 'MORATORIUM_NOT_FOUND',
          message: 'Moratorium not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    // Check territorial access for municipal coordinators
    if (req.user?.role === 'municipal_coordinator' && req.user.id) {
      const userTerritories = await getUserTerritories(req.user.id);
      const userMunicipalityCodes = userTerritories.map(t => t.municipalityCode);

      if (!userMunicipalityCodes.includes(moratorium.municipalityCode)) {
        res.status(403).json({
          error: {
            code: 'TERRITORIAL_ACCESS_DENIED',
            message: 'Access denied to moratoriums outside your territory',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
        return;
      }
    }

    res.json({
      success: true,
      data: { moratorium }
    });
  } catch (error) {
    console.error('Get moratorium error:', error);
    res.status(500).json({
      error: {
        code: 'FETCH_MORATORIUM_FAILED',
        message: 'Failed to fetch moratorium',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// POST /api/moratoriums - Create new moratorium
router.post('/',
  authenticateToken,
  RBACMiddleware.requireRole(['municipal_coordinator', 'regional_admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createMoratoriumSchema.parse(req.body);

      // Check territorial permissions for municipal coordinators
      if (req.user?.role === 'municipal_coordinator' && req.user.id) {
        const userTerritories = await getUserTerritories(req.user.id);
        const userMunicipalityCodes = userTerritories.map(t => t.municipalityCode);

        if (!userMunicipalityCodes.includes(validatedData.municipalityCode)) {
          res.status(403).json({
            error: {
              code: 'TERRITORIAL_ACCESS_DENIED',
              message: 'You can only create moratoriums in your assigned territories',
              timestamp: new Date().toISOString(),
              requestId: req.requestId
            }
          });
          return;
        }
      }

      // Validate moratorium overlap
      const overlapCheck = await moratoriumModel.validateMoratoriumOverlap(
        validatedData.geometry,
        validatedData.validFrom,
        validatedData.validTo,
        validatedData.municipalityCode
      );

      if (!req.user?.id) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
        return;
      }

      const moratorium = await moratoriumModel.create(validatedData, req.user.id!);

      // Trigger notifications for moratorium creation
      setTimeout(async () => {
        try {
          await notificationTriggers.onMoratoriumCreated(moratorium);
        } catch (error) {
          console.error('Async moratorium notification failed:', error);
        }
      }, 0);

      res.status(201).json({
        success: true,
        data: {
          moratorium,
          overlapWarnings: overlapCheck.warnings
        }
      });
    } catch (error) {
      console.error('Create moratorium error:', error);
      res.status(400).json({
        error: {
          code: 'CREATE_MORATORIUM_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create moratorium',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
    }
  }
);

// PUT /api/moratoriums/:id - Update moratorium
router.put('/:id',
  authenticateToken,
  RBACMiddleware.requireRole(['municipal_coordinator', 'regional_admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          error: {
            code: 'INVALID_ID',
            message: 'Moratorium ID is required',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
        return;
      }

      const existingMoratorium = await moratoriumModel.findById(id);
      if (!existingMoratorium) {
        res.status(404).json({
          error: {
            code: 'MORATORIUM_NOT_FOUND',
            message: 'Moratorium not found',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
        return;
      }

      // Check permissions
      if (req.user?.role === 'municipal_coordinator') {
        const userTerritories = await getUserTerritories(req.user.id);
        const userMunicipalityCodes = userTerritories.map(t => t.municipalityCode);

        if (!userMunicipalityCodes.includes(existingMoratorium.municipalityCode)) {
          res.status(403).json({
            error: {
              code: 'TERRITORIAL_ACCESS_DENIED',
              message: 'You can only edit moratoriums in your assigned territories',
              timestamp: new Date().toISOString(),
              requestId: req.requestId
            }
          });
          return;
        }
      }

      const updatedMoratorium = await moratoriumModel.update(id!, req.body);

      res.json({
        success: true,
        data: { moratorium: updatedMoratorium }
      });
    } catch (error) {
      console.error('Update moratorium error:', error);
      res.status(400).json({
        error: {
          code: 'UPDATE_MORATORIUM_FAILED',
          message: error instanceof Error ? error.message : 'Failed to update moratorium',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
    }
  }
);

// DELETE /api/moratoriums/:id - Delete moratorium
router.delete('/:id',
  authenticateToken,
  RBACMiddleware.requireRole(['municipal_coordinator', 'regional_admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          error: {
            code: 'INVALID_ID',
            message: 'Moratorium ID is required',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
        return;
      }

      const existingMoratorium = await moratoriumModel.findById(id);
      if (!existingMoratorium) {
        res.status(404).json({
          error: {
            code: 'MORATORIUM_NOT_FOUND',
            message: 'Moratorium not found',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
        return;
      }

      // Check permissions
      if (req.user?.role === 'municipal_coordinator') {
        const userTerritories = await getUserTerritories(req.user.id);
        const userMunicipalityCodes = userTerritories.map(t => t.municipalityCode);

        if (!userMunicipalityCodes.includes(existingMoratorium.municipalityCode)) {
          res.status(403).json({
            error: {
              code: 'TERRITORIAL_ACCESS_DENIED',
              message: 'You can only delete moratoriums in your assigned territories',
              timestamp: new Date().toISOString(),
              requestId: req.requestId
            }
          });
          return;
        }
      }

      const deleted = await moratoriumModel.delete(id!);

      if (!deleted) {
        res.status(500).json({
          error: {
            code: 'DELETE_FAILED',
            message: 'Failed to delete moratorium',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
        return;
      }

      res.json({
        success: true,
        message: 'Moratorium deleted successfully'
      });
    } catch (error) {
      console.error('Delete moratorium error:', error);
      res.status(500).json({
        error: {
          code: 'DELETE_MORATORIUM_FAILED',
          message: 'Failed to delete moratorium',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
    }
  }
);

// GET /api/moratoriums/municipality/:code/statistics - Get moratorium statistics for municipality
router.get('/municipality/:code/statistics', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;
    
    if (!code) {
      res.status(400).json({
        error: {
          code: 'INVALID_CODE',
          message: 'Municipality code is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    // Check territorial access for municipal coordinators
    if (req.user?.role === 'municipal_coordinator' && req.user.id) {
      const userTerritories = await getUserTerritories(req.user.id);
      const userMunicipalityCodes = userTerritories.map(t => t.municipalityCode);

      if (!userMunicipalityCodes.includes(code)) {
        res.status(403).json({
          error: {
            code: 'TERRITORIAL_ACCESS_DENIED',
            message: 'Access denied to statistics outside your territory',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
        return;
      }
    }

    const statistics = await moratoriumModel.getMoratoriumStatistics(code);

    res.json({
      success: true,
      data: {
        municipalityCode: code,
        statistics
      }
    });
  } catch (error) {
    console.error('Get moratorium statistics error:', error);
    res.status(500).json({
      error: {
        code: 'STATISTICS_FAILED',
        message: 'Failed to get moratorium statistics',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// Helper function to get user territories (would be moved to a service)
async function getUserTerritories(userId: string): Promise<Array<{ municipalityCode: string, municipalityName: string }>> {
  // This would typically use the UserModel or TerritorialService
  // For now, return empty array as placeholder
  return [];
}

export default router;