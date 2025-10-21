import { Router, Request, Response } from 'express';
import { AuditService } from '../services/AuditService';
import { pool } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();
const auditService = new AuditService(pool);

/**
 * GET /api/audit/entity/:entityType/:entityId
 * Get audit logs for a specific entity
 */
router.get('/entity/:entityType/:entityId', 
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const { page = 1, limit = 50, action } = req.query;

      // Validate entity type
      if (!['project', 'user', 'moratorium'].includes(entityType)) {
        return res.status(400).json({
          error: 'Invalid entity type. Must be project, user, or moratorium'
        });
      }

      // Check permissions - users can only view audit logs for entities they have access to
      const user = (req as any).user;
      
      // Regional admins can view all audit logs
      if (user.role !== 'regional_admin') {
        // For projects, check if user has access
        if (entityType === 'project') {
          // Check if user is the applicant or has territorial access
          const projectQuery = `
            SELECT applicant_id, affected_municipalities 
            FROM projects 
            WHERE id = $1
          `;
          const projectResult = await pool.query(projectQuery, [entityId]);
          
          if (projectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
          }

          const project = projectResult.rows[0];
          
          // Applicants can view their own project audit logs
          if (user.role === 'applicant' && project.applicant_id !== user.id) {
            return res.status(403).json({ error: 'Access denied' });
          }

          // Municipal coordinators need territorial access
          if (user.role === 'municipal_coordinator') {
            const territoryQuery = `
              SELECT municipality_code FROM user_territories WHERE user_id = $1
            `;
            const territoryResult = await pool.query(territoryQuery, [user.id]);
            const userMunicipalities = territoryResult.rows.map(row => row.municipality_code);
            
            const hasAccess = project.affected_municipalities?.some((municipality: string) => 
              userMunicipalities.includes(municipality)
            );
            
            if (!hasAccess) {
              return res.status(403).json({ error: 'Access denied' });
            }
          }
        }
        
        // For user audit logs, only allow viewing own logs unless admin
        if (entityType === 'user' && entityId !== user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const result = await auditService.getEntityAuditLogs(
        entityType,
        entityId,
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          action: action as string
        }
      );

      res.json({
        logs: result.logs,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          totalPages: Math.ceil(result.total / parseInt(limit as string))
        }
      });

    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/audit/user/:userId
 * Get audit logs for a user's actions (admin only)
 */
router.get('/user/:userId',
  authenticateToken,
  requireRole(['regional_admin']),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 50, entityType, action } = req.query;

      const result = await auditService.getUserAuditLogs(
        userId,
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          entityType: entityType as string,
          action: action as string
        }
      );

      res.json({
        logs: result.logs,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          totalPages: Math.ceil(result.total / parseInt(limit as string))
        }
      });

    } catch (error) {
      console.error('Error fetching user audit logs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/audit/recent
 * Get recent audit logs (admin only)
 */
router.get('/recent',
  authenticateToken,
  requireRole(['regional_admin']),
  async (req: Request, res: Response) => {
    try {
      const { limit = 100, entityType, action } = req.query;

      const query = `
        SELECT 
          al.id, al.entity_type, al.entity_id, al.action, al.user_id, 
          al.old_values, al.new_values, al.ip_address, al.created_at,
          u.name as user_name, u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${entityType ? 'WHERE al.entity_type = $1' : ''}
        ${action ? (entityType ? 'AND' : 'WHERE') + ' al.action = $' + (entityType ? '2' : '1') : ''}
        ORDER BY al.created_at DESC
        LIMIT $${entityType && action ? '3' : entityType || action ? '2' : '1'}
      `;

      const values: any[] = [];
      if (entityType) values.push(entityType);
      if (action) values.push(action);
      values.push(parseInt(limit as string));

      const result = await pool.query(query, values);
      
      const logs = result.rows.map(row => ({
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        userId: row.user_id,
        oldValues: row.old_values,
        newValues: row.new_values,
        ipAddress: row.ip_address,
        createdAt: new Date(row.created_at),
        userName: row.user_name,
        userEmail: row.user_email
      }));

      res.json({ logs });

    } catch (error) {
      console.error('Error fetching recent audit logs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;