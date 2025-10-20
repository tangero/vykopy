import { Pool } from 'pg';
import { Project, Moratorium, ConflictDetectionResult } from '../types';
import { ProjectModel } from '../models/Project';
import { MoratoriumModel } from '../models/Moratorium';
import { notificationTriggers } from './NotificationTriggers';

export class ConflictDetectionService {
  private projectModel: ProjectModel;
  private moratoriumModel: MoratoriumModel;

  constructor(private db: Pool) {
    this.projectModel = new ProjectModel(db);
    this.moratoriumModel = new MoratoriumModel(db);
  }

  /**
   * Detects all types of conflicts for a given project geometry and time period
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
        this.detectSpatialConflicts(geometry, startDate, endDate, excludeProjectId),
        this.detectMoratoriumViolations(geometry, startDate, endDate)
      ]);

      // Filter spatial conflicts to get only those with temporal overlap
      const temporalConflicts = spatialConflicts.filter(project => 
        this.hasTemporalOverlap(
          startDate, 
          endDate, 
          project!.startDate.toISOString().split('T')[0]!, 
          project!.endDate.toISOString().split('T')[0]!
        )
      );

      const hasConflict = spatialConflicts.length > 0 || moratoriumViolations.length > 0;

      return {
        hasConflict,
        spatialConflicts,
        temporalConflicts,
        moratoriumViolations
      };
    } catch (error) {
      console.error('Error in conflict detection:', error);
      throw new Error('Failed to detect conflicts');
    }
  }

  /**
   * Detects spatial conflicts using PostGIS with 20m buffer
   */
  private async detectSpatialConflicts(
    geometry: GeoJSON.Geometry,
    startDate: string,
    endDate: string,
    excludeProjectId?: string
  ): Promise<Project[]> {
    let query = `
      SELECT 
        id, name, applicant_id, contractor_organization, contractor_contact,
        state, start_date, end_date, ST_AsGeoJSON(geometry)::json as geometry,
        work_type, work_category, description, has_conflict, 
        conflicting_project_ids, affected_municipalities, created_at, updated_at
      FROM projects 
      WHERE state IN ('approved', 'in_progress', 'pending_approval')
      AND ST_DWithin(
        geometry, 
        ST_Buffer(ST_GeomFromGeoJSON($1), 20), 
        0
      )
    `;

    const values: any[] = [JSON.stringify(geometry)];
    let paramIndex = 2;

    if (excludeProjectId) {
      query += ` AND id != $${paramIndex}`;
      values.push(excludeProjectId);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToProject(row));
  }

  /**
   * Detects moratorium violations
   */
  private async detectMoratoriumViolations(
    geometry: GeoJSON.Geometry,
    startDate: string,
    endDate: string
  ): Promise<Moratorium[]> {
    return this.moratoriumModel.checkViolations(geometry, startDate, endDate);
  }

  /**
   * Checks if two time periods overlap
   */
  private hasTemporalOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const startDate1 = new Date(start1);
    const endDate1 = new Date(end1);
    const startDate2 = new Date(start2);
    const endDate2 = new Date(end2);

    return (
      (startDate1 <= startDate2 && endDate1 >= startDate2) ||
      (startDate1 <= endDate2 && endDate1 >= endDate2) ||
      (startDate1 >= startDate2 && endDate1 <= endDate2)
    );
  }

  /**
   * Updates conflict status for a project after detection
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

    // Also update the conflicting projects to mark them as having conflicts
    for (const conflictingProject of conflictResult.spatialConflicts) {
      const existingConflictIds = conflictingProject.conflictingProjectIds || [];
      if (!existingConflictIds.includes(projectId)) {
        existingConflictIds.push(projectId);
        await this.projectModel.updateConflictStatus(
          conflictingProject.id,
          true,
          existingConflictIds
        );
      }
    }
  }

  /**
   * Detects affected municipalities for a geometry
   */
  async detectAffectedMunicipalities(geometry: GeoJSON.Geometry): Promise<string[]> {
    // This would typically query a municipalities table with PostGIS
    // For now, we'll return a placeholder implementation
    // In a real system, you'd have a municipalities table with geometry data
    
    const query = `
      SELECT DISTINCT municipality_code
      FROM municipalities 
      WHERE ST_Intersects(geometry, ST_GeomFromGeoJSON($1))
    `;

    try {
      const result = await this.db.query(query, [JSON.stringify(geometry)]);
      return result.rows.map(row => row.municipality_code);
    } catch (error) {
      // If municipalities table doesn't exist yet, return empty array
      console.warn('Municipalities table not found, returning empty array');
      return [];
    }
  }

  /**
   * Runs conflict detection for an existing project
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

    // Trigger notifications if conflicts are detected
    if (conflictResult.hasConflict) {
      const allConflicts = [
        ...conflictResult.spatialConflicts,
        ...conflictResult.temporalConflicts
      ];
      
      // Remove duplicates
      const uniqueConflicts = allConflicts.filter((conflict, index, self) => 
        index === self.findIndex(c => c.id === conflict.id)
      );

      // Trigger conflict notifications asynchronously
      setTimeout(async () => {
        try {
          await notificationTriggers.onConflictsDetected(project, uniqueConflicts);
        } catch (error) {
          console.error('Failed to send conflict notifications:', error);
        }
      }, 0);
    }

    return conflictResult;
  }

  /**
   * Batch conflict detection for multiple projects
   */
  async runBatchConflictDetection(projectIds: string[]): Promise<Map<string, ConflictDetectionResult>> {
    const results = new Map<string, ConflictDetectionResult>();

    // Process projects in parallel with a reasonable concurrency limit
    const batchSize = 5;
    for (let i = 0; i < projectIds.length; i += batchSize) {
      const batch = projectIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (projectId) => {
        try {
          const result = await this.runConflictDetectionForProject(projectId);
          return { projectId, result };
        } catch (error) {
          console.error(`Error processing project ${projectId}:`, error);
          return { projectId, result: null };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ projectId, result }) => {
        if (result) {
          results.set(projectId, result);
        }
      });
    }

    return results;
  }

  /**
   * Gets conflict statistics for a set of projects
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
    const conditions: string[] = [];
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN has_conflict = true THEN 1 END) as projects_with_conflicts,
        COUNT(CASE WHEN array_length(conflicting_project_ids, 1) > 0 THEN 1 END) as spatial_conflicts
      FROM projects 
      ${whereClause}
      AND state IN ('approved', 'in_progress', 'pending_approval')
    `;

    const result = await this.db.query(query, values);
    const stats = result.rows[0];

    // Count moratorium violations separately
    let moratoriumViolations = 0;
    if (filters.municipalityCodes) {
      const moratoriumQuery = `
        SELECT COUNT(DISTINCT p.id) as violations
        FROM projects p
        JOIN moratoriums m ON ST_Intersects(p.geometry, m.geometry)
        WHERE p.affected_municipalities && $1
        AND (
          (m.valid_from <= p.start_date AND m.valid_to >= p.start_date) OR
          (m.valid_from <= p.end_date AND m.valid_to >= p.end_date) OR
          (m.valid_from >= p.start_date AND m.valid_to <= p.end_date)
        )
        AND p.state IN ('approved', 'in_progress', 'pending_approval')
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
   * Creates a buffer around geometry using PostGIS
   */
  async createBuffer(geometry: GeoJSON.Geometry, bufferMeters: number): Promise<GeoJSON.Geometry> {
    const query = `
      SELECT ST_AsGeoJSON(ST_Buffer(ST_GeomFromGeoJSON($1), $2))::json as buffered_geometry
    `;
    
    const result = await this.db.query(query, [
      JSON.stringify(geometry),
      bufferMeters
    ]);

    return result.rows[0]?.buffered_geometry;
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
}