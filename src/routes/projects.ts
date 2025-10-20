import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { ProjectModel } from '../models/Project';
import { UserModel } from '../models/User';
import { ConflictDetectionService } from '../services/ConflictDetectionService';
import { authenticateToken } from '../middleware/auth';
import { RBACMiddleware } from '../middleware/rbac';
import { createProjectSchema, updateProjectSchema } from '../validation/schemas';
import { ProjectState } from '../types';
import { notificationTriggers } from '../services/NotificationTriggers';

const router = Router();

// Initialize services (this would typically be injected via DI)
let projectModel: ProjectModel;
let conflictService: ConflictDetectionService;

export const initializeProjectRoutes = (db: Pool) => {
  projectModel = new ProjectModel(db);
  conflictService = new ConflictDetectionService(db);
};

// GET /api/projects - List projects with filters
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      state,
      municipality,
      startDate,
      endDate,
      workCategory,
      hasConflict,
      page = '1',
      limit = '20'
    } = req.query;

    const filters: any = {
      page: parseInt(page as string),
      limit: Math.min(parseInt(limit as string), 100) // Max 100 items per page
    };

    // Apply filters based on query parameters
    if (state) filters.state = state as ProjectState;
    if (municipality) filters.municipality = municipality as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (workCategory) filters.workCategory = workCategory as string;
    if (hasConflict !== undefined) filters.hasConflict = hasConflict === 'true';

    // Apply territorial restrictions for municipal coordinators
    if (req.user?.role === 'municipal_coordinator' && req.user.id) {
      // Get user's territories and filter projects
      const userTerritories = await UserModel.getUserTerritories(req.user.id);
      filters.municipalityCodes = userTerritories.map(t => t.municipalityCode);
    }

    // Applicants can only see their own projects
    if (req.user?.role === 'applicant' && req.user.id) {
      filters.applicantId = req.user.id;
    }

    const result = await projectModel.findMany(filters);

    res.json({
      success: true,
      data: {
        projects: result.projects,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / filters.limit)
        }
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      error: {
        code: 'FETCH_PROJECTS_FAILED',
        message: 'Failed to fetch projects',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// GET /api/projects/:id - Get project by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        error: {
          code: 'INVALID_ID',
          message: 'Project ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }
    
    const project = await projectModel.findById(id);

    if (!project) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    // Check access permissions
    if (req.user?.role === 'applicant' && req.user.id && project.applicantId !== req.user.id) {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to this project',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    // Check territorial access for municipal coordinators
    if (req.user?.role === 'municipal_coordinator' && req.user.id) {
      const userTerritories = await UserModel.getUserTerritories(req.user.id);
      const userMunicipalityCodes = userTerritories.map(t => t.municipalityCode);
      const hasAccess = project.affectedMunicipalities.some(code => 
        userMunicipalityCodes.includes(code)
      );

      if (!hasAccess) {
        res.status(403).json({
          error: {
            code: 'TERRITORIAL_ACCESS_DENIED',
            message: 'Access denied to projects outside your territory',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
        return;
      }
    }

    res.json({
      success: true,
      data: { project }
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      error: {
        code: 'FETCH_PROJECT_FAILED',
        message: 'Failed to fetch project',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// POST /api/projects - Create new project
router.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createProjectSchema.parse(req.body);
    
    // Create the project
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
    
    const project = await projectModel.create(validatedData, req.user.id);

    // Trigger notifications for project creation
    setTimeout(async () => {
      try {
        await notificationTriggers.onProjectCreated(project);
        await conflictService.runConflictDetectionForProject(project.id);
      } catch (error) {
        console.error('Async notification/conflict detection failed:', error);
      }
    }, 0);

    res.status(201).json({
      success: true,
      data: { project }
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(400).json({
      error: {
        code: 'CREATE_PROJECT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create project',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!validateId(id, res, 'Project ID')) return;
    
    const validatedData = updateProjectSchema.parse(req.body);

    const existingProject = await projectModel.findById(id);
    if (!existingProject) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    // Check permissions
    const userId = ensureUserId(req, res);
    if (!userId) return;
    
    if (req.user?.role === 'applicant' && existingProject.applicantId !== userId) {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only edit your own projects',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    const updatedProject = await projectModel.update(id, validatedData);

    if (!updatedProject) {
      res.status(500).json({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update project',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    // Trigger notifications and re-run conflict detection if geometry or dates changed
    if (validatedData.geometry || validatedData.startDate || validatedData.endDate) {
      setTimeout(async () => {
        try {
          await notificationTriggers.onProjectUpdated(updatedProject, existingProject, userId);
          await conflictService.runConflictDetectionForProject(id);
        } catch (error) {
          console.error('Async notification/conflict detection failed:', error);
        }
      }, 0);
    }

    res.json({
      success: true,
      data: { project: updatedProject }
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(400).json({
      error: {
        code: 'UPDATE_PROJECT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update project',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// PUT /api/projects/:id/status - Change project status
router.put('/:id/status', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!validateId(id, res, 'Project ID')) return;
    
    const { state } = req.body;

    if (!state) {
      res.status(400).json({
        error: {
          code: 'MISSING_STATE',
          message: 'New state is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    const existingProject = await projectModel.findById(id);
    if (!existingProject) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    // Check permissions for state changes
    if (state === 'approved' || state === 'rejected') {
      if (req.user?.role !== 'municipal_coordinator' && req.user?.role !== 'regional_admin') {
        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Only coordinators can approve or reject projects',
            timestamp: new Date().toISOString(),
            requestId: req.requestId
          }
        });
        return;
      }
    }

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
    
    const userId = ensureUserId(req, res);
    if (!userId) return;
    
    const oldState = existingProject.state;
    const updatedProject = await projectModel.changeState(id, state, userId);

    if (!updatedProject) {
      res.status(500).json({
        error: {
          code: 'STATE_CHANGE_FAILED',
          message: 'Failed to change project state',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    // Trigger notifications for state change
    setTimeout(async () => {
      try {
        await notificationTriggers.onProjectStateChanged(updatedProject, oldState, userId);
      } catch (error) {
        console.error('Async state change notification failed:', error);
      }
    }, 0);

    res.json({
      success: true,
      data: { project: updatedProject }
    });
  } catch (error) {
    console.error('Change project status error:', error);
    res.status(400).json({
      error: {
        code: 'STATUS_CHANGE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to change project status',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// GET /api/projects/:id/conflicts - Get conflict analysis for project
router.get('/:id/conflicts', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!validateId(id, res, 'Project ID')) return;
    
    const project = await projectModel.findById(id);
    if (!project) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    const conflictResult = await conflictService.runConflictDetectionForProject(id);

    res.json({
      success: true,
      data: { conflicts: conflictResult }
    });
  } catch (error) {
    console.error('Get project conflicts error:', error);
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

// POST /api/projects/:id/comments - Add comment to project
router.post('/:id/comments', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!validateId(id, res, 'Project ID')) return;
    
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'MISSING_CONTENT',
          message: 'Comment content is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    if (content.length > 1000) {
      res.status(400).json({
        error: {
          code: 'CONTENT_TOO_LONG',
          message: 'Comment content must be 1000 characters or less',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    const project = await projectModel.findById(id);
    if (!project) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    // Check access permissions
    if (req.user?.role === 'applicant' && req.user.id && project.applicantId !== req.user.id) {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to this project',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

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

    const comment = await projectModel.addComment(id, req.user.id, content.trim());

    // Trigger notifications for new comment
    setTimeout(async () => {
      try {
        await notificationTriggers.onCommentAdded(project, comment, req.user!);
      } catch (error) {
        console.error('Async comment notification failed:', error);
      }
    }, 0);

    res.status(201).json({
      success: true,
      data: { comment }
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      error: {
        code: 'ADD_COMMENT_FAILED',
        message: 'Failed to add comment',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// GET /api/projects/:id/comments - Get project comments
router.get('/:id/comments', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!validateId(id, res, 'Project ID')) return;
    
    const project = await projectModel.findById(id);
    if (!project) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    // Check access permissions
    if (req.user?.role === 'applicant' && req.user.id && project.applicantId !== req.user.id) {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to this project',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    const comments = await projectModel.getComments(id);

    res.json({
      success: true,
      data: { comments }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      error: {
        code: 'FETCH_COMMENTS_FAILED',
        message: 'Failed to fetch comments',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!validateId(id, res, 'Project ID')) return;

    const existingProject = await projectModel.findById(id);
    if (!existingProject) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    // Check permissions
    if (req.user?.role === 'applicant' && existingProject.applicantId !== req.user.id) {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only delete your own projects',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

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
    
    const deleted = await projectModel.delete(id, req.user.id);

    if (!deleted) {
      res.status(500).json({
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete project',
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
      return;
    }

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      error: {
        code: 'DELETE_PROJECT_FAILED',
        message: 'Failed to delete project',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
  }
});

// Helper function to ensure user ID is available
function ensureUserId(req: Request, res: Response): string | null {
  if (!req.user?.id) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'User authentication required',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      }
    });
    return null;
  }
  return req.user.id;
}

// Helper function to validate route parameter ID
function validateId(id: string | undefined, res: Response, paramName: string = 'ID'): id is string {
  if (!id) {
    res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: `${paramName} is required`,
        timestamp: new Date().toISOString()
      }
    });
    return false;
  }
  return true;
}



export default router;