import { Router, Request, Response } from 'express';
import { TerritorialService } from '../services/TerritorialService';
import { authenticateToken } from '../middleware/auth';
import { requireRegionalAdmin } from '../middleware/rbac';

const router = Router();

// All territory routes require authentication
router.use(authenticateToken);

// GET /api/territories/municipalities - Get all municipalities
router.get('/municipalities', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const municipalities = await TerritorialService.getAllMunicipalities();
    
    res.json({
      success: true,
      data: {
        municipalities,
        total: municipalities.length,
      },
    });
  } catch (error) {
    console.error('Get municipalities error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve municipalities',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// GET /api/territories/municipalities/:orp - Get municipalities by ORP
router.get('/municipalities/:orp', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { orp } = req.params;
    
    if (!orp) {
      res.status(400).json({
        error: {
          code: 'MISSING_ORP',
          message: 'ORP parameter is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }
    
    const municipalities = await TerritorialService.getMunicipalitiesByORP(orp);
    
    res.json({
      success: true,
      data: {
        orp,
        municipalities,
        total: municipalities.length,
      },
    });
  } catch (error) {
    console.error('Get municipalities by ORP error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve municipalities by ORP',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// GET /api/territories/coverage - Get territorial coverage report
router.get('/coverage', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const report = await TerritorialService.getTerritorialCoverageReport();
    
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Get territorial coverage error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate territorial coverage report',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// GET /api/territories/users - Get all users with their territories
router.get('/users', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const usersWithTerritories = await TerritorialService.getUsersWithTerritories();
    
    res.json({
      success: true,
      data: {
        users: usersWithTerritories,
        total: usersWithTerritories.length,
      },
    });
  } catch (error) {
    console.error('Get users with territories error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve users with territories',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// GET /api/territories/conflicts - Get territorial conflicts
router.get('/conflicts', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const conflicts = await TerritorialService.getTerritorialConflicts();
    
    res.json({
      success: true,
      data: {
        conflicts,
        total: conflicts.length,
      },
    });
  } catch (error) {
    console.error('Get territorial conflicts error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve territorial conflicts',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// POST /api/territories/conflicts/resolve - Resolve territorial conflicts
router.post('/conflicts/resolve', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const resolvedCount = await TerritorialService.resolveTerritorialConflicts();
    
    res.json({
      success: true,
      data: {
        resolvedConflicts: resolvedCount,
        message: `Resolved ${resolvedCount} territorial conflicts`,
      },
    });
  } catch (error) {
    console.error('Resolve territorial conflicts error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to resolve territorial conflicts',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// POST /api/territories/validate - Validate municipality codes
router.post('/validate', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { codes } = req.body;
    
    if (!Array.isArray(codes)) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Codes must be an array',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }
    
    const validation = await TerritorialService.validateMunicipalityCodes(codes);
    
    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error('Validate municipality codes error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to validate municipality codes',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// POST /api/territories/bulk-assign - Bulk assign territories
router.post('/bulk-assign', requireRegionalAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { assignments } = req.body;
    
    if (!Array.isArray(assignments)) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Assignments must be an array',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }
    
    // Validate assignment structure
    for (const assignment of assignments) {
      if (!assignment.userId || !Array.isArray(assignment.territories)) {
        res.status(400).json({
          error: {
            code: 'INVALID_ASSIGNMENT',
            message: 'Each assignment must have userId and territories array',
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
        return;
      }
    }
    
    await TerritorialService.bulkAssignTerritories(assignments);
    
    res.json({
      success: true,
      data: {
        assignedUsers: assignments.length,
        message: 'Territories assigned successfully',
      },
    });
  } catch (error) {
    console.error('Bulk assign territories error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to bulk assign territories',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

export default router;