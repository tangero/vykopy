import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { ConflictDetectionService } from '../services/ConflictDetectionService';
import { MoratoriumModel } from '../models/Moratorium';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Initialize services
let conflictService: ConflictDetectionService;
let moratoriumModel: MoratoriumModel;

export const initializeSpatialRoutes = (db: Pool) => {
  conflictService = new ConflictDetectionService(db);
  moratoriumModel = new MoratoriumModel(db);
};

// Validation schemas
const conflictDetectionSchema = z.object({
  geometry: z.object({
    type: z.string(),
    coordinates: z.array(z.any())
  }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  excludeProjectId: z.string().uuid().optional()
});

const municipalityDetectionSchema = z.object({
  geometry: z.object({
    type: z.string(),
    coordinates: z.array(z.any())
  })
});

const bufferSchema = z.object({
  geometry: z.object({
    type: z.string(),
    coordinates: z.array(z.any())
  }),
  bufferMeters: z.number().min(0).max(1000)
});

// POST /api/spatial/conflicts - Detect conflicts for given geometry and time period
router.post('/conflicts', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    
    // Validate request body
    const validatedData = conflictDetectionSchema.parse(req.body);
    
    // Validate date range
    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);
    
    if (endDate <= startDate) {
      res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'End date must be after start date',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    // Run conflict detection
    const conflictResult = await conflictService.detectConflicts(
      validatedData.geometry as GeoJSON.Geometry,
      validatedData.startDate,
      validatedData.endDate,
      validatedData.excludeProjectId
    );

    const processingTime = Date.now() - startTime;

    // Check if processing took too long (requirement: within 10 seconds)
    if (processingTime > 10000) {
      console.warn(`Conflict detection took ${processingTime}ms, exceeding 10s requirement`);
    }

    res.json({
      success: true,
      data: {
        conflicts: conflictResult,
        processingTimeMs: processingTime,
        metadata: {
          spatialConflictsCount: conflictResult.spatialConflicts.length,
          temporalConflictsCount: conflictResult.temporalConflicts.length,
          moratoriumViolationsCount: conflictResult.moratoriumViolations.length,
          hasAnyConflict: conflictResult.hasConflict
        }
      }
    });
  } catch (error) {
    console.error('Conflict detection error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'CONFLICT_DETECTION_FAILED',
        message: 'Failed to detect conflicts',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// GET /api/spatial/municipalities - Get affected municipalities for geometry
router.post('/municipalities', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = municipalityDetectionSchema.parse(req.body);
    
    const municipalities = await conflictService.detectAffectedMunicipalities(
      validatedData.geometry as GeoJSON.Geometry
    );

    res.json({
      success: true,
      data: {
        municipalities,
        count: municipalities.length
      }
    });
  } catch (error) {
    console.error('Municipality detection error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'MUNICIPALITY_DETECTION_FAILED',
        message: 'Failed to detect affected municipalities',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// POST /api/spatial/buffer - Create buffer around geometry
router.post('/buffer', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = bufferSchema.parse(req.body);
    
    // Create buffer using ConflictDetectionService
    const bufferedGeometry = await conflictService.createBuffer(
      validatedData.geometry as GeoJSON.Geometry,
      validatedData.bufferMeters
    );

    if (!bufferedGeometry) {
      res.status(500).json({
        error: {
          code: 'BUFFER_CREATION_FAILED',
          message: 'Failed to create buffer geometry',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        originalGeometry: validatedData.geometry,
        bufferedGeometry,
        bufferMeters: validatedData.bufferMeters
      }
    });
  } catch (error) {
    console.error('Buffer creation error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'BUFFER_CREATION_FAILED',
        message: 'Failed to create buffer',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// GET /api/spatial/moratoriums/active - Get active moratoriums in area
router.post('/moratoriums/active', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { geometry, bufferMeters = 0, date } = req.body;
    
    if (!geometry) {
      res.status(400).json({
        error: {
          code: 'MISSING_GEOMETRY',
          message: 'Geometry is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    const activeMoratoriums = await moratoriumModel.getActiveMoratoriumsInArea(
      geometry,
      bufferMeters,
      date
    );

    res.json({
      success: true,
      data: {
        moratoriums: activeMoratoriums,
        count: activeMoratoriums.length,
        searchParameters: {
          bufferMeters,
          date: date || new Date().toISOString().split('T')[0]
        }
      }
    });
  } catch (error) {
    console.error('Active moratoriums detection error:', error);
    
    res.status(500).json({
      error: {
        code: 'MORATORIUM_DETECTION_FAILED',
        message: 'Failed to detect active moratoriums',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// POST /api/spatial/moratoriums/check - Check moratorium violations for project
router.post('/moratoriums/check', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { geometry, startDate, endDate, municipalityCodes } = req.body;
    
    if (!geometry || !startDate || !endDate) {
      res.status(400).json({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Geometry, startDate, and endDate are required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    const violationCheck = await moratoriumModel.checkProjectViolations(
      geometry,
      startDate,
      endDate,
      municipalityCodes
    );

    res.json({
      success: true,
      data: violationCheck
    });
  } catch (error) {
    console.error('Moratorium violation check error:', error);
    
    res.status(500).json({
      error: {
        code: 'MORATORIUM_CHECK_FAILED',
        message: 'Failed to check moratorium violations',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// GET /api/spatial/statistics - Get conflict statistics
router.get('/statistics', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { municipalityCodes, startDate, endDate } = req.query;
    
    const filters: any = {};
    
    if (municipalityCodes) {
      filters.municipalityCodes = Array.isArray(municipalityCodes) 
        ? municipalityCodes as string[]
        : [municipalityCodes as string];
    }
    
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;

    // Apply territorial restrictions for municipal coordinators
    if (req.user?.role === 'municipal_coordinator') {
      // Get user's territories and filter statistics
      // This would need to be implemented with proper territory service
      filters.municipalityCodes = ['placeholder']; // Replace with actual territories
    }

    const statistics = await conflictService.getConflictStatistics(filters);

    res.json({
      success: true,
      data: {
        statistics,
        filters
      }
    });
  } catch (error) {
    console.error('Get conflict statistics error:', error);
    
    res.status(500).json({
      error: {
        code: 'STATISTICS_FAILED',
        message: 'Failed to get conflict statistics',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

export default router;