import { Pool } from 'pg';
import { Project, ProjectState, CreateProjectRequest, UpdateProjectRequest, ConflictDetectionResult } from '../types';
import { createProjectSchema, updateProjectSchema } from '../validation/schemas';

export class ProjectModel {
  constructor(private db: Pool) {}

  // Valid state transitions for workflow management
  private static readonly STATE_TRANSITIONS: Record<ProjectState, ProjectState[]> = {
    draft: ['forward_planning', 'pending_approval'],
    forward_planning: ['pending_approval'],
    pending_approval: ['approved', 'rejected'],
    approved: ['in_progress', 'cancelled'],
    in_progress: ['completed'],
    completed: [],
    rejected: [],
    cancelled: []
  };

  /**
   * Validates if a state transition is allowed
   */
  static isValidStateTransition(currentState: ProjectState, newState: ProjectState): boolean {
    return ProjectModel.STATE_TRANSITIONS[currentState].includes(newState);
  }

  /**
   * Gets allowed next states for a given current state
   */
  static getAllowedNextStates(currentState: ProjectState): ProjectState[] {
    return ProjectModel.STATE_TRANSITIONS[currentState];
  }

  /**
   * Creates a new project
   */
  async create(data: CreateProjectRequest, applicantId: string): Promise<Project> {
    // Validate input data
    const validatedData = createProjectSchema.parse(data);

    const query = `
      INSERT INTO projects (
        name, applicant_id, contractor_organization, contractor_contact,
        start_date, end_date, geometry, work_type, work_category, description
      ) VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromGeoJSON($7), $8, $9, $10)
      RETURNING 
        id, name, applicant_id, contractor_organization, contractor_contact,
        state, start_date, end_date, ST_AsGeoJSON(geometry)::json as geometry,
        work_type, work_category, description, has_conflict, 
        conflicting_project_ids, affected_municipalities, created_at, updated_at
    `;

    const values = [
      validatedData.name,
      applicantId,
      validatedData.contractorOrganization || null,
      validatedData.contractorContact ? JSON.stringify(validatedData.contractorContact) : null,
      validatedData.startDate,
      validatedData.endDate,
      JSON.stringify(validatedData.geometry),
      validatedData.workType,
      validatedData.workCategory,
      validatedData.description || null
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToProject(result.rows[0]);
  }

  /**
   * Gets a project by ID
   */
  async findById(id: string): Promise<Project | null> {
    const query = `
      SELECT 
        id, name, applicant_id, contractor_organization, contractor_contact,
        state, start_date, end_date, ST_AsGeoJSON(geometry)::json as geometry,
        work_type, work_category, description, has_conflict, 
        conflicting_project_ids, affected_municipalities, created_at, updated_at
      FROM projects 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapRowToProject(result.rows[0]) : null;
  }

  /**
   * Updates a project
   */
  async update(id: string, data: UpdateProjectRequest): Promise<Project | null> {
    const validatedData = updateProjectSchema.parse(data);
    
    // If state is being changed, validate the transition
    if (validatedData.state) {
      const currentProject = await this.findById(id);
      if (!currentProject) {
        throw new Error('Project not found');
      }
      
      if (!ProjectModel.isValidStateTransition(currentProject.state, validatedData.state)) {
        throw new Error(`Invalid state transition from ${currentProject.state} to ${validatedData.state}`);
      }
    }

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    Object.entries(validatedData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'geometry') {
          updateFields.push(`geometry = ST_GeomFromGeoJSON($${paramIndex})`);
          values.push(JSON.stringify(value));
        } else if (key === 'contractorContact') {
          updateFields.push(`contractor_contact = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          // Convert camelCase to snake_case for database columns
          const dbColumn = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          updateFields.push(`${dbColumn} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE projects 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, name, applicant_id, contractor_organization, contractor_contact,
        state, start_date, end_date, ST_AsGeoJSON(geometry)::json as geometry,
        work_type, work_category, description, has_conflict, 
        conflicting_project_ids, affected_municipalities, created_at, updated_at
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapRowToProject(result.rows[0]) : null;
  }

  /**
   * Changes project state with validation
   */
  async changeState(id: string, newState: ProjectState, userId: string): Promise<Project | null> {
    const currentProject = await this.findById(id);
    if (!currentProject) {
      throw new Error('Project not found');
    }

    if (!ProjectModel.isValidStateTransition(currentProject.state, newState)) {
      throw new Error(`Invalid state transition from ${currentProject.state} to ${newState}`);
    }

    // Log the state change in audit trail
    await this.logStateChange(id, currentProject.state, newState, userId);

    return this.update(id, { state: newState });
  }

  /**
   * Finds projects with filters and pagination
   */
  async findMany(filters: {
    state?: ProjectState;
    municipality?: string;
    startDate?: string;
    endDate?: string;
    workCategory?: string;
    hasConflict?: boolean;
    applicantId?: string;
    municipalityCodes?: string[];
    page?: number;
    limit?: number;
  }): Promise<{ projects: Project[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (filters.state) {
      conditions.push(`state = $${paramIndex++}`);
      values.push(filters.state);
    }

    if (filters.municipality) {
      conditions.push(`$${paramIndex} = ANY(affected_municipalities)`);
      values.push(filters.municipality);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`end_date >= $${paramIndex++}`);
      values.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`start_date <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    if (filters.workCategory) {
      conditions.push(`work_category = $${paramIndex++}`);
      values.push(filters.workCategory);
    }

    if (filters.hasConflict !== undefined) {
      conditions.push(`has_conflict = $${paramIndex++}`);
      values.push(filters.hasConflict);
    }

    if (filters.applicantId) {
      conditions.push(`applicant_id = $${paramIndex++}`);
      values.push(filters.applicantId);
    }

    if (filters.municipalityCodes && filters.municipalityCodes.length > 0) {
      conditions.push(`affected_municipalities && $${paramIndex++}`);
      values.push(filters.municipalityCodes);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total records
    const countQuery = `SELECT COUNT(*) FROM projects ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        id, name, applicant_id, contractor_organization, contractor_contact,
        state, start_date, end_date, ST_AsGeoJSON(geometry)::json as geometry,
        work_type, work_category, description, has_conflict, 
        conflicting_project_ids, affected_municipalities, created_at, updated_at
      FROM projects 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const result = await this.db.query(query, values);
    const projects = result.rows.map(row => this.mapRowToProject(row));

    return { projects, total };
  }

  /**
   * Deletes a project (soft delete by changing state to cancelled)
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const project = await this.findById(id);
    if (!project) {
      return false;
    }

    // Only allow deletion of draft projects or change to cancelled for others
    if (project.state === 'draft') {
      const query = 'DELETE FROM projects WHERE id = $1';
      await this.db.query(query, [id]);
    } else {
      await this.changeState(id, 'cancelled', userId);
    }

    return true;
  }

  /**
   * Updates conflict status for a project
   */
  async updateConflictStatus(id: string, hasConflict: boolean, conflictingProjectIds: string[]): Promise<void> {
    const query = `
      UPDATE projects 
      SET has_conflict = $1, conflicting_project_ids = $2, updated_at = NOW()
      WHERE id = $3
    `;
    await this.db.query(query, [hasConflict, conflictingProjectIds, id]);
  }

  /**
   * Updates affected municipalities for a project
   */
  async updateAffectedMunicipalities(id: string, municipalities: string[]): Promise<void> {
    const query = `
      UPDATE projects 
      SET affected_municipalities = $1, updated_at = NOW()
      WHERE id = $2
    `;
    await this.db.query(query, [municipalities, id]);
  }

  /**
   * Finds projects that spatially intersect with given geometry
   */
  async findSpatiallyIntersecting(geometry: GeoJSON.Geometry, bufferMeters: number = 20): Promise<Project[]> {
    const query = `
      SELECT 
        id, name, applicant_id, contractor_organization, contractor_contact,
        state, start_date, end_date, ST_AsGeoJSON(geometry)::json as geometry,
        work_type, work_category, description, has_conflict, 
        conflicting_project_ids, affected_municipalities, created_at, updated_at
      FROM projects 
      WHERE state IN ('approved', 'in_progress')
      AND ST_DWithin(geometry, ST_Buffer(ST_GeomFromGeoJSON($1), $2), 0)
    `;

    const result = await this.db.query(query, [JSON.stringify(geometry), bufferMeters]);
    return result.rows.map(row => this.mapRowToProject(row));
  }

  /**
   * Finds projects with temporal overlap
   */
  async findTemporallyOverlapping(startDate: string, endDate: string, excludeProjectId?: string): Promise<Project[]> {
    let query = `
      SELECT 
        id, name, applicant_id, contractor_organization, contractor_contact,
        state, start_date, end_date, ST_AsGeoJSON(geometry)::json as geometry,
        work_type, work_category, description, has_conflict, 
        conflicting_project_ids, affected_municipalities, created_at, updated_at
      FROM projects 
      WHERE state IN ('approved', 'in_progress')
      AND (
        (start_date <= $1 AND end_date >= $1) OR
        (start_date <= $2 AND end_date >= $2) OR
        (start_date >= $1 AND end_date <= $2)
      )
    `;

    const values: any[] = [startDate, endDate];

    if (excludeProjectId) {
      query += ' AND id != $3';
      values.push(excludeProjectId);
    }

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToProject(row));
  }

  /**
   * Logs state change in audit trail
   */
  private async logStateChange(projectId: string, oldState: ProjectState, newState: ProjectState, userId: string): Promise<void> {
    const query = `
      INSERT INTO audit_logs (entity_type, entity_id, action, user_id, old_values, new_values)
      VALUES ('project', $1, 'state_change', $2, $3, $4)
    `;

    const oldValues = { state: oldState };
    const newValues = { state: newState };

    await this.db.query(query, [
      projectId,
      userId,
      JSON.stringify(oldValues),
      JSON.stringify(newValues)
    ]);
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