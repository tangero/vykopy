import { Pool } from 'pg';
import { AuditService, AuditLogEntry } from './AuditService';

export interface ProjectHistoryEntry {
  id: string;
  timestamp: Date;
  action: 'create' | 'update' | 'delete' | 'state_change' | 'comment';
  userId?: string;
  userName?: string;
  userRole?: string;
  description: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  ipAddress?: string;
}

export interface ProjectHistoryFilter {
  startDate?: Date;
  endDate?: Date;
  action?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

export class ProjectHistoryService {
  private auditService: AuditService;

  constructor(private db: Pool) {
    this.auditService = new AuditService(db);
  }

  /**
   * Gets complete history for a project including audit logs and comments
   */
  async getProjectHistory(
    projectId: string, 
    filters?: ProjectHistoryFilter
  ): Promise<{ entries: ProjectHistoryEntry[]; total: number }> {
    const entries: ProjectHistoryEntry[] = [];

    // Get audit logs for the project
    const auditResult = await this.auditService.getEntityAuditLogs(
      'project',
      projectId,
      {
        page: filters?.page || 1,
        limit: filters?.limit || 100,
        action: filters?.action
      }
    );

    // Convert audit logs to history entries
    for (const log of auditResult.logs) {
      const historyEntry = await this.convertAuditLogToHistoryEntry(log);
      if (historyEntry) {
        entries.push(historyEntry);
      }
    }

    // Get comments for the project
    const commentsResult = await this.getProjectComments(projectId, filters);
    entries.push(...commentsResult);

    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply date filters if specified
    let filteredEntries = entries;
    if (filters?.startDate || filters?.endDate) {
      filteredEntries = entries.filter(entry => {
        if (filters.startDate && entry.timestamp < filters.startDate) return false;
        if (filters.endDate && entry.timestamp > filters.endDate) return false;
        return true;
      });
    }

    // Apply user filter if specified
    if (filters?.userId) {
      filteredEntries = filteredEntries.filter(entry => entry.userId === filters.userId);
    }

    return {
      entries: filteredEntries,
      total: filteredEntries.length
    };
  }

  /**
   * Gets project history in CSV format for export
   */
  async exportProjectHistoryToCsv(projectId: string, filters?: ProjectHistoryFilter): Promise<string> {
    const { entries } = await this.getProjectHistory(projectId, filters);

    // CSV headers
    const headers = [
      'Timestamp',
      'Action',
      'User Name',
      'User Role',
      'Description',
      'Changes',
      'IP Address'
    ];

    // Convert entries to CSV rows
    const rows = entries.map(entry => [
      entry.timestamp.toISOString(),
      entry.action,
      entry.userName || '',
      entry.userRole || '',
      entry.description,
      entry.changes ? entry.changes.map(c => `${c.field}: ${c.oldValue} → ${c.newValue}`).join('; ') : '',
      entry.ipAddress || ''
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * Gets timeline of project state changes
   */
  async getProjectStateTimeline(projectId: string): Promise<{
    state: string;
    timestamp: Date;
    userId?: string;
    userName?: string;
  }[]> {
    const query = `
      SELECT 
        al.new_values->>'state' as state,
        al.created_at,
        al.user_id,
        u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = 'project' 
        AND al.entity_id = $1 
        AND al.action IN ('create', 'state_change')
        AND al.new_values->>'state' IS NOT NULL
      ORDER BY al.created_at ASC
    `;

    const result = await this.db.query(query, [projectId]);
    
    return result.rows.map(row => ({
      state: row.state,
      timestamp: new Date(row.created_at),
      userId: row.user_id,
      userName: row.user_name
    }));
  }

  /**
   * Gets statistics about project changes
   */
  async getProjectChangeStatistics(projectId: string): Promise<{
    totalChanges: number;
    changesByAction: Record<string, number>;
    changesByUser: Record<string, { count: number; userName: string }>;
    firstChange: Date;
    lastChange: Date;
  }> {
    const query = `
      SELECT 
        al.action,
        al.user_id,
        u.name as user_name,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = 'project' AND al.entity_id = $1
      ORDER BY al.created_at ASC
    `;

    const result = await this.db.query(query, [projectId]);
    
    const changesByAction: Record<string, number> = {};
    const changesByUser: Record<string, { count: number; userName: string }> = {};
    
    result.rows.forEach(row => {
      // Count by action
      changesByAction[row.action] = (changesByAction[row.action] || 0) + 1;
      
      // Count by user
      if (row.user_id) {
        if (!changesByUser[row.user_id]) {
          changesByUser[row.user_id] = { count: 0, userName: row.user_name || 'Unknown' };
        }
        const userEntry = changesByUser[row.user_id];
        if (userEntry) {
          userEntry.count++;
        }
      }
    });

    return {
      totalChanges: result.rows.length,
      changesByAction,
      changesByUser,
      firstChange: result.rows.length > 0 ? new Date(result.rows[0].created_at) : new Date(),
      lastChange: result.rows.length > 0 ? new Date(result.rows[result.rows.length - 1].created_at) : new Date()
    };
  }

  /**
   * Converts audit log entry to history entry
   */
  private async convertAuditLogToHistoryEntry(log: AuditLogEntry): Promise<ProjectHistoryEntry | null> {
    // Get user information
    let userName: string | undefined;
    let userRole: string | undefined;
    
    if (log.userId) {
      const userQuery = `SELECT name, role FROM users WHERE id = $1`;
      const userResult = await this.db.query(userQuery, [log.userId]);
      if (userResult.rows.length > 0) {
        userName = userResult.rows[0].name;
        userRole = userResult.rows[0].role;
      }
    }

    // Generate description and changes based on action
    let description: string;
    let changes: { field: string; oldValue: any; newValue: any }[] = [];

    switch (log.action) {
      case 'create':
        description = 'Project created';
        break;
        
      case 'update':
        description = 'Project updated';
        if (log.oldValues && log.newValues) {
          changes = this.extractChanges(log.oldValues, log.newValues);
        }
        break;
        
      case 'state_change':
        const oldState = log.oldValues?.state;
        const newState = log.newValues?.state;
        description = `Project state changed from ${oldState} to ${newState}`;
        changes = [{ field: 'state', oldValue: oldState, newValue: newState }];
        break;
        
      case 'delete':
        description = 'Project deleted';
        break;
        
      default:
        description = `Project ${log.action}`;
    }

    return {
      id: log.id,
      timestamp: log.createdAt,
      action: log.action,
      userId: log.userId,
      userName,
      userRole,
      description,
      changes: changes.length > 0 ? changes : undefined,
      ipAddress: log.ipAddress
    };
  }

  /**
   * Gets project comments as history entries
   */
  private async getProjectComments(projectId: string, filters?: ProjectHistoryFilter): Promise<ProjectHistoryEntry[]> {
    let query = `
      SELECT 
        pc.id, pc.content, pc.created_at, pc.user_id,
        u.name as user_name, u.role as user_role
      FROM project_comments pc
      LEFT JOIN users u ON pc.user_id = u.id
      WHERE pc.project_id = $1
    `;

    const values: any[] = [projectId];
    let paramIndex = 2;

    if (filters?.startDate) {
      query += ` AND pc.created_at >= $${paramIndex++}`;
      values.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ` AND pc.created_at <= $${paramIndex++}`;
      values.push(filters.endDate);
    }

    if (filters?.userId) {
      query += ` AND pc.user_id = $${paramIndex++}`;
      values.push(filters.userId);
    }

    query += ' ORDER BY pc.created_at DESC';

    const result = await this.db.query(query, values);
    
    return result.rows.map(row => ({
      id: row.id,
      timestamp: new Date(row.created_at),
      action: 'comment' as const,
      userId: row.user_id,
      userName: row.user_name,
      userRole: row.user_role,
      description: `Comment added: ${row.content.substring(0, 100)}${row.content.length > 100 ? '...' : ''}`,
      ipAddress: undefined
    }));
  }

  /**
   * Extracts changes between old and new values
   */
  private extractChanges(oldValues: Record<string, any>, newValues: Record<string, any>): {
    field: string;
    oldValue: any;
    newValue: any;
  }[] {
    const changes: { field: string; oldValue: any; newValue: any }[] = [];
    
    // Check all fields in new values
    for (const [field, newValue] of Object.entries(newValues)) {
      const oldValue = oldValues[field];
      
      // Skip if values are the same
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
        continue;
      }
      
      // Format values for display
      let formattedOldValue = this.formatValueForDisplay(field, oldValue);
      let formattedNewValue = this.formatValueForDisplay(field, newValue);
      
      changes.push({
        field: this.formatFieldName(field),
        oldValue: formattedOldValue,
        newValue: formattedNewValue
      });
    }
    
    return changes;
  }

  /**
   * Formats field names for display
   */
  private formatFieldName(field: string): string {
    const fieldNames: Record<string, string> = {
      name: 'Project Name',
      contractorOrganization: 'Contractor Organization',
      contractorContact: 'Contractor Contact',
      startDate: 'Start Date',
      endDate: 'End Date',
      workType: 'Work Type',
      workCategory: 'Work Category',
      description: 'Description',
      state: 'Status',
      geometry: 'Location'
    };
    
    return fieldNames[field] || field;
  }

  /**
   * Formats values for display in history
   */
  private formatValueForDisplay(field: string, value: any): string {
    if (value === null || value === undefined) {
      return 'Not set';
    }
    
    // Handle dates
    if (field.includes('Date') && typeof value === 'string') {
      return new Date(value).toLocaleDateString();
    }
    
    // Handle geometry
    if (field === 'geometry') {
      return '[Geographic data]';
    }
    
    // Handle objects
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  }
}