import { Pool } from 'pg';
import { Request } from 'express';

export interface AuditLogEntry {
  id: string;
  entityType: 'project' | 'user' | 'moratorium';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'state_change';
  userId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

export interface CreateAuditLogRequest {
  entityType: 'project' | 'user' | 'moratorium';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'state_change';
  userId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
}

export class AuditService {
  constructor(private db: Pool) {}

  /**
   * Creates a new audit log entry
   */
  async createAuditLog(data: CreateAuditLogRequest): Promise<AuditLogEntry> {
    const query = `
      INSERT INTO audit_logs (
        entity_type, entity_id, action, user_id, old_values, new_values, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, entity_type, entity_id, action, user_id, old_values, new_values, ip_address, created_at
    `;

    const values = [
      data.entityType,
      data.entityId,
      data.action,
      data.userId || null,
      data.oldValues ? JSON.stringify(data.oldValues) : null,
      data.newValues ? JSON.stringify(data.newValues) : null,
      data.ipAddress || null
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToAuditLog(result.rows[0]);
  }

  /**
   * Gets audit logs for a specific entity
   */
  async getEntityAuditLogs(
    entityType: string, 
    entityId: string, 
    options?: {
      page?: number;
      limit?: number;
      action?: string;
    }
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const conditions = ['entity_type = $1', 'entity_id = $2'];
    const values: any[] = [entityType, entityId];
    let paramIndex = 3;

    if (options?.action) {
      conditions.push(`action = $${paramIndex++}`);
      values.push(options.action);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count total records
    const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        id, entity_type, entity_id, action, user_id, old_values, new_values, ip_address, created_at
      FROM audit_logs 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const result = await this.db.query(query, values);
    const logs = result.rows.map(row => this.mapRowToAuditLog(row));

    return { logs, total };
  }

  /**
   * Gets audit logs for a user's actions
   */
  async getUserAuditLogs(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      entityType?: string;
      action?: string;
    }
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const conditions = ['user_id = $1'];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (options?.entityType) {
      conditions.push(`entity_type = $${paramIndex++}`);
      values.push(options.entityType);
    }

    if (options?.action) {
      conditions.push(`action = $${paramIndex++}`);
      values.push(options.action);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count total records
    const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        al.id, al.entity_type, al.entity_id, al.action, al.user_id, 
        al.old_values, al.new_values, al.ip_address, al.created_at,
        u.name as user_name, u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const result = await this.db.query(query, values);
    const logs = result.rows.map(row => ({
      ...this.mapRowToAuditLog(row),
      userName: row.user_name,
      userEmail: row.user_email
    }));

    return { logs, total };
  }

  /**
   * Creates a diff between old and new values
   */
  static createDiff(oldValues: Record<string, any>, newValues: Record<string, any>): {
    changed: Record<string, { from: any; to: any }>;
    added: Record<string, any>;
    removed: Record<string, any>;
  } {
    const changed: Record<string, { from: any; to: any }> = {};
    const added: Record<string, any> = {};
    const removed: Record<string, any> = {};

    // Find changed and removed fields
    for (const [key, oldValue] of Object.entries(oldValues)) {
      if (key in newValues) {
        if (JSON.stringify(oldValue) !== JSON.stringify(newValues[key])) {
          changed[key] = { from: oldValue, to: newValues[key] };
        }
      } else {
        removed[key] = oldValue;
      }
    }

    // Find added fields
    for (const [key, newValue] of Object.entries(newValues)) {
      if (!(key in oldValues)) {
        added[key] = newValue;
      }
    }

    return { changed, added, removed };
  }

  /**
   * Logs a project creation
   */
  async logProjectCreation(projectId: string, projectData: Record<string, any>, userId: string, ipAddress?: string): Promise<void> {
    await this.createAuditLog({
      entityType: 'project',
      entityId: projectId,
      action: 'create',
      userId,
      newValues: this.sanitizeProjectData(projectData),
      ipAddress
    });
  }

  /**
   * Logs a project update
   */
  async logProjectUpdate(
    projectId: string, 
    oldData: Record<string, any>, 
    newData: Record<string, any>, 
    userId: string, 
    ipAddress?: string
  ): Promise<void> {
    const diff = AuditService.createDiff(oldData, newData);
    
    // Only log if there are actual changes
    if (Object.keys(diff.changed).length > 0 || Object.keys(diff.added).length > 0 || Object.keys(diff.removed).length > 0) {
      await this.createAuditLog({
        entityType: 'project',
        entityId: projectId,
        action: 'update',
        userId,
        oldValues: this.sanitizeProjectData(oldData),
        newValues: this.sanitizeProjectData(newData),
        ipAddress
      });
    }
  }

  /**
   * Logs a project state change
   */
  async logProjectStateChange(
    projectId: string, 
    oldState: string, 
    newState: string, 
    userId: string, 
    ipAddress?: string
  ): Promise<void> {
    await this.createAuditLog({
      entityType: 'project',
      entityId: projectId,
      action: 'state_change',
      userId,
      oldValues: { state: oldState },
      newValues: { state: newState },
      ipAddress
    });
  }

  /**
   * Logs a project deletion
   */
  async logProjectDeletion(projectId: string, projectData: Record<string, any>, userId: string, ipAddress?: string): Promise<void> {
    await this.createAuditLog({
      entityType: 'project',
      entityId: projectId,
      action: 'delete',
      userId,
      oldValues: this.sanitizeProjectData(projectData),
      ipAddress
    });
  }

  /**
   * Logs a user action
   */
  async logUserAction(
    userId: string, 
    action: 'create' | 'update' | 'delete', 
    oldData?: Record<string, any>, 
    newData?: Record<string, any>, 
    actorUserId?: string, 
    ipAddress?: string
  ): Promise<void> {
    await this.createAuditLog({
      entityType: 'user',
      entityId: userId,
      action,
      userId: actorUserId,
      oldValues: oldData ? this.sanitizeUserData(oldData) : undefined,
      newValues: newData ? this.sanitizeUserData(newData) : undefined,
      ipAddress
    });
  }

  /**
   * Logs a moratorium action
   */
  async logMoratoriumAction(
    moratoriumId: string, 
    action: 'create' | 'update' | 'delete', 
    oldData?: Record<string, any>, 
    newData?: Record<string, any>, 
    userId?: string, 
    ipAddress?: string
  ): Promise<void> {
    await this.createAuditLog({
      entityType: 'moratorium',
      entityId: moratoriumId,
      action,
      userId,
      oldValues: oldData,
      newValues: newData,
      ipAddress
    });
  }

  /**
   * Gets client IP address from request
   */
  static getClientIpAddress(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      'unknown'
    );
  }

  /**
   * Sanitizes project data for logging (removes sensitive information)
   */
  private sanitizeProjectData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };
    
    // Remove or mask sensitive fields if any
    if (sanitized.contractorContact) {
      // Keep structure but mask phone/email if needed
      sanitized.contractorContact = {
        ...sanitized.contractorContact,
        // Could mask phone/email here if required by privacy policy
      };
    }

    // Convert geometry to a simplified representation for logging
    if (sanitized.geometry) {
      sanitized.geometry = {
        type: sanitized.geometry.type,
        coordinates: '[GEOMETRY_DATA]' // Simplified for audit log
      };
    }

    return sanitized;
  }

  /**
   * Sanitizes user data for logging (removes sensitive information)
   */
  private sanitizeUserData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };
    
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.passwordHash;
    delete sanitized.password_hash;
    
    return sanitized;
  }

  /**
   * Maps database row to AuditLogEntry
   */
  private mapRowToAuditLog(row: any): AuditLogEntry {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      userId: row.user_id,
      oldValues: row.old_values,
      newValues: row.new_values,
      ipAddress: row.ip_address,
      createdAt: new Date(row.created_at)
    };
  }
}