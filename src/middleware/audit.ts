import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/AuditService';
import { pool } from '../config/database';

// Extend Request interface to include audit context
declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        entityType?: 'project' | 'user' | 'moratorium';
        entityId?: string;
        action?: 'create' | 'update' | 'delete' | 'state_change';
        oldValues?: Record<string, any>;
      };
    }
  }
}

export class AuditMiddleware {
  private static auditService = new AuditService(pool);

  /**
   * Middleware to capture request data for audit logging
   */
  static captureAuditContext() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Initialize audit context
      req.auditContext = {};

      // Store original response methods to intercept them
      const originalSend = res.send;
      const originalJson = res.json;

      // Override res.send to capture response data
      res.send = function(data: any) {
        AuditMiddleware.processAuditLog(req, res, data);
        return originalSend.call(this, data);
      };

      // Override res.json to capture response data
      res.json = function(data: any) {
        AuditMiddleware.processAuditLog(req, res, data);
        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Middleware to set audit context for specific routes
   */
  static setAuditContext(entityType: 'project' | 'user' | 'moratorium', action?: 'create' | 'update' | 'delete' | 'state_change') {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.auditContext) {
        req.auditContext = {};
      }
      
      req.auditContext.entityType = entityType;
      if (action) {
        req.auditContext.action = action;
      }

      // Try to extract entity ID from route parameters
      if (req.params.id) {
        req.auditContext.entityId = req.params.id;
      }

      next();
    };
  }

  /**
   * Middleware to capture old values before update/delete operations
   */
  static captureOldValues(getOldValuesFn: (req: Request) => Promise<Record<string, any> | null>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auditContext) {
          req.auditContext = {};
        }

        const oldValues = await getOldValuesFn(req);
        if (oldValues) {
          req.auditContext.oldValues = oldValues;
        }

        next();
      } catch (error) {
        console.error('Error capturing old values for audit:', error);
        next(); // Continue even if audit capture fails
      }
    };
  }

  /**
   * Process and create audit log based on request/response
   */
  private static async processAuditLog(req: Request, res: Response, responseData: any) {
    try {
      // Only log successful operations (2xx status codes)
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return;
      }

      // Only log if audit context is set
      if (!req.auditContext?.entityType) {
        return;
      }

      const userId = (req as any).user?.id;
      const ipAddress = AuditService.getClientIpAddress(req);
      const { entityType, entityId, action, oldValues } = req.auditContext;

      // Determine action from HTTP method if not explicitly set
      let auditAction = action;
      if (!auditAction) {
        switch (req.method) {
          case 'POST':
            auditAction = 'create';
            break;
          case 'PUT':
          case 'PATCH':
            auditAction = 'update';
            break;
          case 'DELETE':
            auditAction = 'delete';
            break;
          default:
            return; // Don't log GET requests
        }
      }

      // Extract entity ID from response if not in context
      let finalEntityId = entityId;
      if (!finalEntityId && responseData && typeof responseData === 'object') {
        finalEntityId = responseData.id || responseData.data?.id;
      }

      if (!finalEntityId) {
        return; // Can't log without entity ID
      }

      // Create audit log entry
      await AuditMiddleware.auditService.createAuditLog({
        entityType,
        entityId: finalEntityId,
        action: auditAction,
        userId,
        oldValues,
        newValues: AuditMiddleware.extractNewValues(responseData, auditAction),
        ipAddress
      });

    } catch (error) {
      console.error('Error creating audit log:', error);
      // Don't throw error to avoid breaking the main request
    }
  }

  /**
   * Extract new values from response data
   */
  private static extractNewValues(responseData: any, action: string): Record<string, any> | undefined {
    if (!responseData || typeof responseData !== 'object') {
      return undefined;
    }

    // For delete operations, we don't need new values
    if (action === 'delete') {
      return undefined;
    }

    // Extract the main data object
    const data = responseData.data || responseData;
    
    if (typeof data === 'object' && data !== null) {
      // Remove metadata fields that shouldn't be in audit log
      const { total, page, limit, ...cleanData } = data;
      return cleanData;
    }

    return undefined;
  }

  /**
   * Helper function to create old values capture for projects
   */
  static captureProjectOldValues() {
    return AuditMiddleware.captureOldValues(async (req: Request) => {
      if (!req.params.id) return null;
      
      try {
        const query = `
          SELECT 
            id, name, applicant_id, contractor_organization, contractor_contact,
            state, start_date, end_date, work_type, work_category, description,
            has_conflict, conflicting_project_ids, affected_municipalities
          FROM projects 
          WHERE id = $1
        `;
        
        const result = await pool.query(query, [req.params.id]);
        return result.rows[0] || null;
      } catch (error) {
        console.error('Error fetching project for audit:', error);
        return null;
      }
    });
  }

  /**
   * Helper function to create old values capture for users
   */
  static captureUserOldValues() {
    return AuditMiddleware.captureOldValues(async (req: Request) => {
      if (!req.params.id) return null;
      
      try {
        const query = `
          SELECT id, email, name, organization, role, is_active
          FROM users 
          WHERE id = $1
        `;
        
        const result = await pool.query(query, [req.params.id]);
        return result.rows[0] || null;
      } catch (error) {
        console.error('Error fetching user for audit:', error);
        return null;
      }
    });
  }

  /**
   * Helper function to create old values capture for moratoriums
   */
  static captureMoratoriumOldValues() {
    return AuditMiddleware.captureOldValues(async (req: Request) => {
      if (!req.params.id) return null;
      
      try {
        const query = `
          SELECT id, name, reason, reason_detail, valid_from, valid_to, 
                 exceptions, created_by, municipality_code
          FROM moratoriums 
          WHERE id = $1
        `;
        
        const result = await pool.query(query, [req.params.id]);
        return result.rows[0] || null;
      } catch (error) {
        console.error('Error fetching moratorium for audit:', error);
        return null;
      }
    });
  }
}

// Export convenience functions
export const auditCapture = AuditMiddleware.captureAuditContext;
export const auditContext = AuditMiddleware.setAuditContext;
export const captureProjectOldValues = AuditMiddleware.captureProjectOldValues;
export const captureUserOldValues = AuditMiddleware.captureUserOldValues;
export const captureMoratoriumOldValues = AuditMiddleware.captureMoratoriumOldValues;