import { ProjectModel } from '../models/Project';
import { MoratoriumModel } from '../models/Moratorium';
import { ProjectState, CreateProjectRequest, CreateMoratoriumRequest } from '../types';

// Mock the database pool
const mockDb = {
  query: jest.fn(),
};

describe('ProjectModel', () => {
  let projectModel: ProjectModel;

  beforeEach(() => {
    jest.clearAllMocks();
    projectModel = new ProjectModel(mockDb as any);
  });

  describe('State Transition Validation', () => {
    it('should allow valid state transitions from draft', () => {
      expect(ProjectModel.isValidStateTransition('draft', 'forward_planning')).toBe(true);
      expect(ProjectModel.isValidStateTransition('draft', 'pending_approval')).toBe(true);
    });

    it('should reject invalid state transitions from draft', () => {
      expect(ProjectModel.isValidStateTransition('draft', 'approved')).toBe(false);
      expect(ProjectModel.isValidStateTransition('draft', 'in_progress')).toBe(false);
      expect(ProjectModel.isValidStateTransition('draft', 'completed')).toBe(false);
      expect(ProjectModel.isValidStateTransition('draft', 'rejected')).toBe(false);
      expect(ProjectModel.isValidStateTransition('draft', 'cancelled')).toBe(false);
    });

    it('should allow valid state transitions from forward_planning', () => {
      expect(ProjectModel.isValidStateTransition('forward_planning', 'pending_approval')).toBe(true);
    });

    it('should reject invalid state transitions from forward_planning', () => {
      expect(ProjectModel.isValidStateTransition('forward_planning', 'draft')).toBe(false);
      expect(ProjectModel.isValidStateTransition('forward_planning', 'approved')).toBe(false);
      expect(ProjectModel.isValidStateTransition('forward_planning', 'in_progress')).toBe(false);
    });

    it('should allow valid state transitions from pending_approval', () => {
      expect(ProjectModel.isValidStateTransition('pending_approval', 'approved')).toBe(true);
      expect(ProjectModel.isValidStateTransition('pending_approval', 'rejected')).toBe(true);
    });

    it('should reject invalid state transitions from pending_approval', () => {
      expect(ProjectModel.isValidStateTransition('pending_approval', 'draft')).toBe(false);
      expect(ProjectModel.isValidStateTransition('pending_approval', 'forward_planning')).toBe(false);
      expect(ProjectModel.isValidStateTransition('pending_approval', 'in_progress')).toBe(false);
    });

    it('should allow valid state transitions from approved', () => {
      expect(ProjectModel.isValidStateTransition('approved', 'in_progress')).toBe(true);
      expect(ProjectModel.isValidStateTransition('approved', 'cancelled')).toBe(true);
    });

    it('should reject invalid state transitions from approved', () => {
      expect(ProjectModel.isValidStateTransition('approved', 'draft')).toBe(false);
      expect(ProjectModel.isValidStateTransition('approved', 'pending_approval')).toBe(false);
      expect(ProjectModel.isValidStateTransition('approved', 'rejected')).toBe(false);
    });

    it('should allow valid state transitions from in_progress', () => {
      expect(ProjectModel.isValidStateTransition('in_progress', 'completed')).toBe(true);
    });

    it('should reject invalid state transitions from in_progress', () => {
      expect(ProjectModel.isValidStateTransition('in_progress', 'draft')).toBe(false);
      expect(ProjectModel.isValidStateTransition('in_progress', 'approved')).toBe(false);
      expect(ProjectModel.isValidStateTransition('in_progress', 'cancelled')).toBe(false);
    });

    it('should reject all transitions from terminal states', () => {
      const terminalStates: ProjectState[] = ['completed', 'rejected', 'cancelled'];
      const allStates: ProjectState[] = [
        'draft', 'forward_planning', 'pending_approval', 
        'approved', 'in_progress', 'completed', 'rejected', 'cancelled'
      ];

      terminalStates.forEach(terminalState => {
        allStates.forEach(targetState => {
          expect(ProjectModel.isValidStateTransition(terminalState, targetState)).toBe(false);
        });
      });
    });

    it('should return correct allowed next states', () => {
      expect(ProjectModel.getAllowedNextStates('draft')).toEqual(['forward_planning', 'pending_approval']);
      expect(ProjectModel.getAllowedNextStates('forward_planning')).toEqual(['pending_approval']);
      expect(ProjectModel.getAllowedNextStates('pending_approval')).toEqual(['approved', 'rejected']);
      expect(ProjectModel.getAllowedNextStates('approved')).toEqual(['in_progress', 'cancelled']);
      expect(ProjectModel.getAllowedNextStates('in_progress')).toEqual(['completed']);
      expect(ProjectModel.getAllowedNextStates('completed')).toEqual([]);
      expect(ProjectModel.getAllowedNextStates('rejected')).toEqual([]);
      expect(ProjectModel.getAllowedNextStates('cancelled')).toEqual([]);
    });
  });

  describe('Project Data Validation', () => {
    const validProjectData: CreateProjectRequest = {
      name: 'Test Project',
      contractorOrganization: 'Test Contractor',
      contractorContact: {
        name: 'John Doe',
        phone: '+420123456789',
        email: 'john@contractor.com'
      },
      startDate: '2024-01-15',
      endDate: '2024-02-15',
      geometry: {
        type: 'Point',
        coordinates: [14.4378, 50.0755] // Prague coordinates
      },
      workType: 'Excavation',
      workCategory: 'Utilities',
      description: 'Test excavation project'
    };

    it('should create project with valid data', async () => {
      const mockResult = {
        rows: [{
          id: 'test-id',
          name: 'Test Project',
          applicant_id: 'user-id',
          contractor_organization: 'Test Contractor',
          contractor_contact: JSON.stringify(validProjectData.contractorContact),
          state: 'draft',
          start_date: '2024-01-15',
          end_date: '2024-02-15',
          geometry: validProjectData.geometry,
          work_type: 'Excavation',
          work_category: 'Utilities',
          description: 'Test excavation project',
          has_conflict: false,
          conflicting_project_ids: [],
          affected_municipalities: [],
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await projectModel.create(validProjectData, 'user-id');

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Project');
      expect(result.state).toBe('draft');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        expect.arrayContaining([
          'Test Project',
          'user-id',
          'Test Contractor',
          JSON.stringify(validProjectData.contractorContact),
          '2024-01-15',
          '2024-02-15',
          JSON.stringify(validProjectData.geometry),
          'Excavation',
          'Utilities',
          'Test excavation project'
        ])
      );
    });

    it('should validate state transition during update', async () => {
      const mockProject = {
        id: 'test-id',
        state: 'draft' as ProjectState,
        name: 'Test Project',
        applicantId: 'user-id',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-02-15'),
        geometry: validProjectData.geometry,
        workType: 'Excavation',
        workCategory: 'Utilities',
        hasConflict: false,
        conflictingProjectIds: [],
        affectedMunicipalities: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock findById to return current project
      jest.spyOn(projectModel, 'findById').mockResolvedValue(mockProject);

      // Test valid state transition
      const mockUpdateResult = {
        rows: [{
          ...mockProject,
          state: 'pending_approval'
        }]
      };
      mockDb.query.mockResolvedValue(mockUpdateResult);

      const result = await projectModel.update('test-id', { state: 'pending_approval' });
      expect(result?.state).toBe('pending_approval');

      // Test invalid state transition
      await expect(
        projectModel.update('test-id', { state: 'completed' })
      ).rejects.toThrow('Invalid state transition from draft to completed');
    });

    it('should handle project not found during update', async () => {
      jest.spyOn(projectModel, 'findById').mockResolvedValue(null);

      await expect(
        projectModel.update('nonexistent-id', { state: 'pending_approval' })
      ).rejects.toThrow('Project not found');
    });

    it('should validate state change with audit logging', async () => {
      const mockProject = {
        id: 'test-id',
        state: 'pending_approval' as ProjectState,
        name: 'Test Project',
        applicantId: 'user-id',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-02-15'),
        geometry: validProjectData.geometry,
        workType: 'Excavation',
        workCategory: 'Utilities',
        hasConflict: false,
        conflictingProjectIds: [],
        affectedMunicipalities: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(projectModel, 'findById').mockResolvedValue(mockProject);
      jest.spyOn(projectModel, 'update').mockResolvedValue({
        ...mockProject,
        state: 'approved'
      });

      // Mock audit log insertion
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await projectModel.changeState('test-id', 'approved', 'coordinator-id');

      expect(result?.state).toBe('approved');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'test-id',
          'coordinator-id',
          JSON.stringify({ state: 'pending_approval' }),
          JSON.stringify({ state: 'approved' })
        ])
      );
    });

    it('should handle project deletion based on state', async () => {
      const draftProject = {
        id: 'draft-id',
        state: 'draft' as ProjectState,
        name: 'Draft Project',
        applicantId: 'user-id',
        startDate: new Date(),
        endDate: new Date(),
        geometry: validProjectData.geometry,
        workType: 'Test',
        workCategory: 'Test',
        hasConflict: false,
        conflictingProjectIds: [],
        affectedMunicipalities: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const approvedProject = {
        ...draftProject,
        id: 'approved-id',
        state: 'approved' as ProjectState
      };

      // Test deletion of draft project (hard delete)
      jest.spyOn(projectModel, 'findById').mockResolvedValueOnce(draftProject);
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 });

      const draftResult = await projectModel.delete('draft-id', 'user-id');
      expect(draftResult).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM projects WHERE id = $1', ['draft-id']);

      // Test deletion of approved project (soft delete to cancelled)
      jest.spyOn(projectModel, 'findById').mockResolvedValueOnce(approvedProject);
      jest.spyOn(projectModel, 'changeState').mockResolvedValueOnce({
        ...approvedProject,
        state: 'cancelled'
      });

      const approvedResult = await projectModel.delete('approved-id', 'user-id');
      expect(approvedResult).toBe(true);
    });
  });

  describe('Spatial and Temporal Queries', () => {
    const testGeometry: GeoJSON.Point = {
      type: 'Point',
      coordinates: [14.4378, 50.0755]
    };

    it('should find spatially intersecting projects', async () => {
      const mockResult = {
        rows: [{
          id: 'intersecting-project',
          name: 'Intersecting Project',
          applicant_id: 'user-id',
          state: 'approved',
          start_date: '2024-01-01',
          end_date: '2024-02-01',
          geometry: testGeometry,
          work_type: 'Test',
          work_category: 'Test',
          has_conflict: false,
          conflicting_project_ids: [],
          affected_municipalities: [],
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await projectModel.findSpatiallyIntersecting(testGeometry, 20);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Intersecting Project');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ST_DWithin'),
        [JSON.stringify(testGeometry), 20]
      );
    });

    it('should find temporally overlapping projects', async () => {
      const mockResult = {
        rows: [{
          id: 'overlapping-project',
          name: 'Overlapping Project',
          applicant_id: 'user-id',
          state: 'approved',
          start_date: '2024-01-10',
          end_date: '2024-01-20',
          geometry: testGeometry,
          work_type: 'Test',
          work_category: 'Test',
          has_conflict: false,
          conflicting_project_ids: [],
          affected_municipalities: [],
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await projectModel.findTemporallyOverlapping('2024-01-15', '2024-01-25');

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Overlapping Project');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('start_date <= $1 AND end_date >= $1'),
        ['2024-01-15', '2024-01-25']
      );
    });

    it('should exclude specific project from temporal overlap search', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await projectModel.findTemporallyOverlapping('2024-01-15', '2024-01-25', 'exclude-id');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND id != $3'),
        ['2024-01-15', '2024-01-25', 'exclude-id']
      );
    });
  });
});

describe('MoratoriumModel', () => {
  let moratoriumModel: MoratoriumModel;

  beforeEach(() => {
    jest.clearAllMocks();
    moratoriumModel = new MoratoriumModel(mockDb as any);
  });

  describe('Moratorium Data Validation', () => {
    const validMoratoriumData: CreateMoratoriumRequest = {
      name: 'Test Moratorium',
      geometry: {
        type: 'Polygon',
        coordinates: [[[14.4, 50.0], [14.5, 50.0], [14.5, 50.1], [14.4, 50.1], [14.4, 50.0]]]
      },
      reason: 'Road reconstruction',
      reasonDetail: 'Major road reconstruction project',
      validFrom: '2024-01-01',
      validTo: '2024-12-31',
      exceptions: 'Emergency repairs allowed',
      municipalityCode: 'CZ0201'
    };

    it('should create moratorium with valid data', async () => {
      const mockResult = {
        rows: [{
          id: 'moratorium-id',
          name: 'Test Moratorium',
          geometry: validMoratoriumData.geometry,
          reason: 'Road reconstruction',
          reason_detail: 'Major road reconstruction project',
          valid_from: '2024-01-01',
          valid_to: '2024-12-31',
          exceptions: 'Emergency repairs allowed',
          created_by: 'coordinator-id',
          municipality_code: 'CZ0201',
          created_at: new Date()
        }]
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await moratoriumModel.create(validMoratoriumData, 'coordinator-id');

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Moratorium');
      expect(result.reason).toBe('Road reconstruction');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO moratoriums'),
        expect.arrayContaining([
          'Test Moratorium',
          JSON.stringify(validMoratoriumData.geometry),
          'Road reconstruction',
          'Major road reconstruction project',
          '2024-01-01',
          '2024-12-31',
          'Emergency repairs allowed',
          'coordinator-id',
          'CZ0201'
        ])
      );
    });

    it('should validate maximum 5-year duration', async () => {
      const longMoratoriumData = {
        ...validMoratoriumData,
        validFrom: '2024-01-01',
        validTo: '2030-01-01' // More than 5 years
      };

      await expect(
        moratoriumModel.create(longMoratoriumData, 'coordinator-id')
      ).rejects.toThrow('Moratorium duration cannot exceed 5 years');
    });

    it('should validate duration with static method', () => {
      // Valid duration (less than 5 years)
      expect(MoratoriumModel.validateDuration('2024-01-01', '2028-12-31')).toBe(true);
      
      // Invalid duration (more than 5 years)
      expect(MoratoriumModel.validateDuration('2024-01-01', '2030-01-01')).toBe(false);
      
      // Invalid duration (end before start)
      expect(MoratoriumModel.validateDuration('2024-01-01', '2023-12-31')).toBe(false);
      
      // Edge case (exactly 5 years)
      expect(MoratoriumModel.validateDuration('2024-01-01', '2029-01-01')).toBe(true);
    });

    it('should find active intersecting moratoriums', async () => {
      const testGeometry: GeoJSON.Point = {
        type: 'Point',
        coordinates: [14.45, 50.05]
      };

      const mockResult = {
        rows: [{
          id: 'active-moratorium',
          name: 'Active Moratorium',
          geometry: validMoratoriumData.geometry,
          reason: 'Active restriction',
          reason_detail: null,
          valid_from: '2024-01-01',
          valid_to: '2024-12-31',
          exceptions: null,
          created_by: 'coordinator-id',
          municipality_code: 'CZ0201',
          created_at: new Date()
        }]
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await moratoriumModel.findActiveIntersecting(testGeometry, '2024-06-15');

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Active Moratorium');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ST_Intersects'),
        ['2024-06-15', JSON.stringify(testGeometry)]
      );
    });

    it('should check moratorium violations', async () => {
      const testGeometry: GeoJSON.Point = {
        type: 'Point',
        coordinates: [14.45, 50.05]
      };

      const mockResult = {
        rows: [{
          id: 'violating-moratorium',
          name: 'Violating Moratorium',
          geometry: validMoratoriumData.geometry,
          reason: 'Violation test',
          reason_detail: null,
          valid_from: '2024-01-01',
          valid_to: '2024-12-31',
          exceptions: null,
          created_by: 'coordinator-id',
          municipality_code: 'CZ0201',
          created_at: new Date()
        }]
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await moratoriumModel.checkViolations(testGeometry, '2024-06-01', '2024-06-30');

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Violating Moratorium');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('valid_from <= $1 AND valid_to >= $1'),
        ['2024-06-01', '2024-06-30', JSON.stringify(testGeometry)]
      );
    });

    it('should find moratoriums expiring soon', async () => {
      const mockResult = {
        rows: [{
          id: 'expiring-moratorium',
          name: 'Expiring Moratorium',
          geometry: validMoratoriumData.geometry,
          reason: 'Expiring soon',
          reason_detail: null,
          valid_from: '2024-01-01',
          valid_to: '2024-02-15',
          exceptions: null,
          created_by: 'coordinator-id',
          municipality_code: 'CZ0201',
          created_at: new Date()
        }]
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await moratoriumModel.findExpiringSoon(30, ['CZ0201']);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Expiring Moratorium');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('valid_to BETWEEN'),
        expect.arrayContaining([expect.any(String), expect.any(String), ['CZ0201']])
      );
    });

    it('should find moratoriums by municipality', async () => {
      const mockResult = {
        rows: [{
          id: 'municipality-moratorium',
          name: 'Municipality Moratorium',
          geometry: validMoratoriumData.geometry,
          reason: 'Municipal restriction',
          reason_detail: null,
          valid_from: '2024-01-01',
          valid_to: '2024-12-31',
          exceptions: null,
          created_by: 'coordinator-id',
          municipality_code: 'CZ0201',
          created_at: new Date()
        }]
      };

      mockDb.query.mockResolvedValue(mockResult);

      // Test with activeOnly = false
      const allResult = await moratoriumModel.findByMunicipality('CZ0201', false);
      expect(allResult).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('municipality_code = $1'),
        ['CZ0201']
      );

      // Test with activeOnly = true
      mockDb.query.mockClear();
      mockDb.query.mockResolvedValue(mockResult);
      
      const activeResult = await moratoriumModel.findByMunicipality('CZ0201', true);
      expect(activeResult).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND valid_from <= $2 AND valid_to >= $2'),
        ['CZ0201', expect.any(String)]
      );
    });
  });
});