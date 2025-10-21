import { Pool } from 'pg';
import { Project, Moratorium, ConflictDetectionResult } from '../types';
import { ProjectModel } from '../models/Project';
import { MoratoriumModel } from '../models/Moratorium';
import { notificationTriggers } from './NotificationTriggers';
import { QueryOptimizer } from './QueryOptimizer';

export class OptimizedConflictDetectionService {
  private projectModel: ProjectModel;
  private moratoriumModel: MoratoriumModel;
  private queryOptimizer: QueryOptimizer;

  constructor(private db: Pool) {
    this.projectModel = new ProjectModel(db);
    this.moratoriumModel = new MoratoriumModel(db);
    this.queryOptimizer = new QueryOptimizer(db);
  }

  /**
   * Detects all types of conflicts for a given project geometry and time period
   * Optimized version with better query performance
   */
  async detectConflicts(
    geometry: GeoJSON.Geometry,
    startDate: string,
    endDate: string,
    excludeProjectId?: string
  ): Promise<ConflictDetectionResult> {
    try {
      // Run spatial and temporal conflict detection in parallel
      const [spatialConflicts, moratoriumViolations] = await Promise.all([
        this.detectSpatialAndTemporalConflicts(geometry, startDate, endDate, excludeProjectId),
        this.detectMoratoriumViolations(geometry, startDate, endDate)
      ]);

      const hasConflict = spatialConflicts.length > 0 || moratoriumViolations.length > 0;

      return {
        hasConflict,
        spatialConflicts,
        temporalConflicts: spatialConflicts, // Already filtered for temporal overlap
        moratoriumViolations
      };
    } catch (error) {
      console.error('Error in optimized conflict detection:', error);
      throw new Error('Failed to detect conflicts');
    }
  }

  /**
   * Optimized spatial and temporal conflict detection in a single query
   */
  private async detectSpatialAndTemporalConflicts(
    geometry: GeoJSON.Geometry,
    startDate: string,
    endDate: string,
    excludeProjectId?: string
  ): Promise<Project[]> {
    // Single optimized query that combines spatial and temporal checks
    let query = `
      SELECT 
        id, name, applicant_id, contractor_organization, contractor_contact,
        state, start_date, end_date, ST_AsGeoJSON(geometry)::json as geometry,
        work_type, work_category, description, has_conflict, 
        conflicting_project_ids, affected_municipalities, created_at, updated_at
      FROM projects 
      WHERE state = ANY($2)
      AND ST_DWithin(geometry, ST_GeomFromGeoJSON($1), 20)
      AND (
        (start_date <= $3 AND end_date >= $3) OR
        (start_date <= $4 AND end_date >= $4) OR
        (start_date >= $3 AND end_date <= $4)
      )
    `;

    const values: any[] = [
      JSON.stringify(geometry),
      ['approved', 'in_progress', 'pending_approval'],
      startDate,
      endDate
    ];
    let paramIndex = 5;

    if (excludeProjectId) {
      query += ` AND id != $${paramIndex}`;
      values.push(excludeProjectId);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC LIMIT 50'; // Limit results for performance

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToProject(row));
  }

  /**
   * Optimized moratorium violation detection
   */
  private async detectMoratoriumViolations(
    geometry: GeoJSON.Geometry,
    startDate: string,
    endDate: string
  ): Promise<Moratorium[]> {
    const query = `
      SELECT 
        id, name, ST_AsGeoJSON(geometry)::json as geometry, reason, reason_detail,
        valid_from, valid_to, exceptions, created_by, municipality_code, created_at
      FROM moratoriums 
      WHERE valid_from <= $2 AND valid_to >= $1
      AND ST_Intersects(geometry, ST_GeomFromGeoJSON($3))
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const result = await this.db.query(query, [startDate, endDate, JSON.stringify(geometry)]);
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      geometry: row.geometry,
      reason: row.reason,
      reasonDetail: row.reason_detail,
      validFrom: new Date(row.valid_from),
      validTo: new Date(row.valid_to),
      exceptions: row.exceptions,
      createdBy: row.created_by,
      municipalityCode: row.municipality_code,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Batch conflict detection with connection pooling optimization
   */
  async runBatchConflictDetection(projectIds: string[]): Promise<Map<string, ConflictDetectionResult>> {
    const results = new Map<string, ConflictDetectionResult>();

    // Process in smaller batches to avoid overwhelming the database
    const batchSize = 3; // Reduced batch size for better performance
    for (let i = 0; i < projectIds.length; i += batchSize) {
      const batch = projectIds.slice(i, i + batchSize);
      
      // Use Promise.allSettled to handle individual failures gracefully
      const batchPromises = batch.map(async (projectId) => {
        try {
          const result = await this.runConflictDetectionForProject(projectId);
          return { projectId, result, success: true };
        } catch (error) {
          console.error(`Error processing project ${projectId}:`, error);
          return { projectId, result: null, success: false };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((promiseResult) => {
        if (promiseResult.status === 'fulfilled' && promiseResult.value.success && promiseResult.value.result) {
          results.set(promiseResult.value.projectId, promiseResult.value.result);
        }
      });

      // Small delay between batches to prevent database overload
      if (i + batchSize < projectIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Optimized conflict statistics with better aggregation
   */
  async getConflictStatistics(filters: {
    municipalityCodes?: string[];
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalProjects: number;
    projectsWithConflicts: number;
    spatialConflicts: number;
    moratoriumViolations: number;
  }> {
    // Single optimized query for all statistics
    const conditions: string[] = ['state IN (\'approved\', \'in_progress\', \'pending_approval\')'];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.municipalityCodes && filters.municipalityCodes.length > 0) {
      conditions.push(`affected_municipalities && $${paramIndex++}`);
      values.push(filters.municipalityCodes);
    }

    if (filters.startDate) {
      conditions.push(`end_date >= $${paramIndex++}`);
      values.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`start_date <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN has_conflict = true THEN 1 END) as projects_with_conflicts,
        COUNT(CASE WHEN array_length(conflicting_project_ids, 1) > 0 THEN 1 END) as spatial_conflicts
      FROM projects 
      ${whereClause}
    `;

    const result = await this.db.query(query, values);
    const stats = result.rows[0];

    // Separate optimized query for moratorium violations
    let moratoriumViolations = 0;
    if (filters.municipalityCodes) {
      const moratoriumQuery = `
        SELECT COUNT(DISTINCT p.id) as violations
        FROM projects p
        WHERE p.affected_municipalities && $1
        AND p.state IN ('approved', 'in_progress', 'pending_approval')
        AND EXISTS (
          SELECT 1 FROM moratoriums m 
          WHERE ST_Intersects(p.geometry, m.geometry)
          AND m.valid_from <= p.start_date 
          AND m.valid_to >= p.start_date
        )
      `;
      
      try {
        const moratoriumResult = await this.db.query(moratoriumQuery, [filters.municipalityCodes]);
        moratoriumViolations = parseInt(moratoriumResult.rows[0].violations) || 0;
      } catch (error) {
        console.warn('Error counting moratorium violations:', error);
      }
    }

    return {
      totalProjects: parseInt(stats.total_projects) || 0,
      projectsWithConflicts: parseInt(stats.projects_with_conflicts) || 0,
      spatialConflicts: parseInt(stats.spatial_conflicts) || 0,
      moratoriumViolations
    };
  }

  /**
   * Runs conflict detection for an existing project with caching
   */
  async runConflictDetectionForProject(projectId: string): Promise<ConflictDetectionResult> {
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const startDate: string = project!.startDate.toISOString().split('T')[0]!;
    const endDate: string = project!.endDate.toISOString().split('T')[0]!;

    const conflictResult = await this.detectConflicts(
      project.geometry,
      startDate,
      endDate,
      projectId
    );

    // Update the project's conflict status
    await this.updateProjectConflictStatus(projectId, conflictResult);

    // Update affected municipalities
    const municipalities = await this.detectAffectedMunicipalities(project.geometry);
    await this.projectModel.updateAffectedMunicipalities(projectId, municipalities);

    // Trigger notifications asynchronously if conflicts are detected
    if (conflictResult.hasConflict) {
      setImmediate(async () => {
        try {
          await notificationTriggers.onConflictsDetected(project, conflictResult.spatialConflicts);
        } catch (error) {
          console.error('Failed to send conflict notifications:', error);
        }
      });
    }

    return conflictResult;
  }

  /**
   * Optimized municipality detection
   */
  async detectAffectedMunicipalities(geometry: GeoJSON.Geometry): Promise<string[]> {
    const query = `
      SELECT DISTINCT municipality_code
      FROM municipalities 
      WHERE ST_Intersects(geometry, ST_GeomFromGeoJSON($1))
      LIMIT 10
    `;

    try {
      const result = await this.db.query(query, [JSON.stringify(geometry)]);
      return result.rows.map(row => row.municipality_code);
    } catch (error) {
      console.warn('Municipalities table not found, returning empty array');
      return [];
    }
  }

  /**
   * Updates conflict status for a project
   */
  async updateProjectConflictStatus(
    projectId: string,
    conflictResult: ConflictDetectionResult
  ): Promise<void> {
    const conflictingProjectIds = conflictResult.spatialConflicts.map(p => p.id);
    
    await this.projectModel.updateConflictStatus(
      projectId,
      conflictResult.hasConflict,
      conflictingProjectIds
    );

    // Batch update conflicting projects
    if (conflictingProjectIds.length > 0) {
      const updateQuery = `
        UPDATE projects 
        SET 
          has_conflict = true,
          conflicting_project_ids = array_append(
            COALESCE(conflicting_project_ids, ARRAY[]::uuid[]), 
            $1::uuid
          ),
          updated_at = NOW()
        WHERE id = ANY($2)
        AND NOT ($1::uuid = ANY(COALESCE(conflicting_project_ids, ARRAY[]::uuid[])))
      `;
      
      await this.db.query(updateQuery, [projectId, conflictingProjectIds]);
    }
  }

  /**
   * Maps database row to Project interface
   */
  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      applicantId: row.applicant_id,
      contractorOrganization: row.contractor_organization,
      contractorContact: row.contractor_contact,
      state: row.state,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      geometry: row.geometry,
      workType: row.work_type,
      workCategory: row.work_category,
      description: row.description,
      hasConflict: row.has_conflict,
      conflictingProjectIds: row.conflicting_project_ids || [],
      affectedMunicipalities: row.affected_municipalities || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Initialize database optimizations
   */
  async initializeOptimizations(): Promise<void> {
    try {
      await this.queryOptimizer.createSpatialIndexes();
      await this.queryOptimizer.optimizeDatabaseConfig();
      console.log('Database optimizations initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database optimizations:', error);
    }
  }
}