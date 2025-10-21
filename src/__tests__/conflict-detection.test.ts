import { ConflictDetectionService } from '../services/ConflictDetectionService';
import { ProjectModel } from '../models/Project';
import { MoratoriumModel } from '../models/Moratorium';
import { Project, Moratorium, ConflictDetectionResult } from '../types';

// Mock the database pool
const mockDb = {
  query: jest.fn(),
};

describe('ConflictDetectionService', () => {
  let conflictService: ConflictDetectionService;
  let projectModel: ProjectModel;
  let moratoriumModel: MoratoriumModel;

  beforeEach(() => {
    jest.clearAllMocks();
    conflictService = new ConflictDetectionService(mockDb as any);
    projectModel = new ProjectModel(mockDb as any);
    moratoriumModel = new MoratoriumModel(mockDb as any);
  });

  describe('Spatial Conflict Detection', () => {
    const testPoint: GeoJSON.Point = {
      type: 'Point',
      coordinates: [14.4378, 50.0755] // Prague coordinates
    };

    const testLineString: GeoJSON.LineString = {
      type: 'LineString',
      coordinates: [
        [14.4378, 50.0755],
        [14.4400, 50.0760]
      ]
    };

    const testPolygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[
        [14.4370, 50.0750],
        [14.4380, 50.0750],
        [14.4380, 50.0760],
        [14.4370, 50.0760],
        [14.4370, 50.0750]
      ]]
    };

    const mockProject: Project = {
      id: 'project-1',
      name: 'Test Project',
      applicantId: 'user-1',
      contractorOrganization: 'Test Contractor',
      contractorContact: undefined,
      state: 'approved',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-02-15'),
      geometry: testPoint,
      workType: 'Excavation',
      workCategory: 'Utilities',
      description: 'Test project',
      hasConflict: false,
      conflictingProjectIds: [],
      affectedMunicipalities: ['CZ0201'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should detect spatial conflicts with point geometry', async () => {
      const mockResult = {
        rows: [{
          id: 'conflicting-project',
          name: 'Conflicting Project',
          applicant_id: 'user-2',
          contractor_organization: 'Other Contractor',
          contractor_contact: null,
          state: 'approved',
          start_date: '2024-01-10',
          end_date: '2024-01-20',
          geometry: testPoint,
          work_type: 'Road Work',
          work_category: 'Infrastructure',
          description: 'Conflicting project',
          has_conflict: false,
          conflicting_project_ids: [],
          affected_municipalities: ['CZ0201'],
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      mockDb.query
        .mockResolvedValueOnce(mockResult) // Spatial conflicts query
        .mockResolvedValueOnce({ rows: [] }); // Moratorium violations query

      const result = await conflictService.detectConflicts(
        testPoint,
        '2024-01-15',
        '2024-01-25'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.spatialConflicts).toHaveLength(1);
      expect(result.spatialConflicts[0]?.name).toBe('Conflicting Project');
      expect(result.temporalConflicts).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ST_DWithin'),
        [JSON.stringify(testPoint)]
      );
    });

    it('should detect spatial conflicts with line geometry', async () => {
      const mockResult = {
        rows: [{
          id: 'line-conflict',
          name: 'Line Conflict Project',
          applicant_id: 'user-3',
          contractor_organization: 'Line Contractor',
          contractor_contact: null,
          state: 'in_progress',
          start_date: '2024-01-01',
          end_date: '2024-03-01',
          geometry: testLineString,
          work_type: 'Cable Installation',
          work_category: 'Utilities',
          description: 'Line project',
          has_conflict: false,
          conflicting_project_ids: [],
          affected_municipalities: ['CZ0201'],
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      mockDb.query
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testLineString,
        '2024-02-01',
        '2024-02-28'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.spatialConflicts).toHaveLength(1);
      expect(result.spatialConflicts[0]?.workType).toBe('Cable Installation');
    });

    it('should detect spatial conflicts with polygon geometry', async () => {
      const mockResult = {
        rows: [{
          id: 'polygon-conflict',
          name: 'Polygon Conflict Project',
          applicant_id: 'user-4',
          contractor_organization: 'Polygon Contractor',
          contractor_contact: null,
          state: 'approved',
          start_date: '2024-01-20',
          end_date: '2024-02-20',
          geometry: testPolygon,
          work_type: 'Area Development',
          work_category: 'Construction',
          description: 'Polygon project',
          has_conflict: false,
          conflicting_project_ids: [],
          affected_municipalities: ['CZ0201'],
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      mockDb.query
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testPolygon,
        '2024-01-25',
        '2024-02-25'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.spatialConflicts).toHaveLength(1);
      expect(result.spatialConflicts[0]?.workCategory).toBe('Construction');
    });

    it('should exclude specified project from spatial conflict detection', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await conflictService.detectConflicts(
        testPoint,
        '2024-01-15',
        '2024-01-25',
        'exclude-project-id'
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND id != $2'),
        [JSON.stringify(testPoint), 'exclude-project-id']
      );
    });

    it('should handle no spatial conflicts', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testPoint,
        '2024-01-15',
        '2024-01-25'
      );

      expect(result.hasConflict).toBe(false);
      expect(result.spatialConflicts).toHaveLength(0);
      expect(result.temporalConflicts).toHaveLength(0);
    });

    it('should use 20-meter buffer for spatial detection', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await conflictService.detectConflicts(
        testPoint,
        '2024-01-15',
        '2024-01-25'
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ST_Buffer(ST_GeomFromGeoJSON($1), 20)'),
        [JSON.stringify(testPoint)]
      );
    });
  });

  describe('Temporal Conflict Detection', () => {
    const testGeometry: GeoJSON.Point = {
      type: 'Point',
      coordinates: [14.4378, 50.0755]
    };

    const createMockProject = (id: string, startDate: string, endDate: string): any => ({
      id,
      name: `Project ${id}`,
      applicant_id: 'user-1',
      contractor_organization: 'Test Contractor',
      contractor_contact: null,
      state: 'approved',
      start_date: startDate,
      end_date: endDate,
      geometry: testGeometry,
      work_type: 'Test Work',
      work_category: 'Test Category',
      description: 'Test project',
      has_conflict: false,
      conflicting_project_ids: [],
      affected_municipalities: ['CZ0201'],
      created_at: new Date(),
      updated_at: new Date()
    });

    it('should detect temporal overlap - start date overlap', async () => {
      const mockResult = {
        rows: [createMockProject('overlap-1', '2024-01-10', '2024-01-20')]
      };

      mockDb.query
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testGeometry,
        '2024-01-15', // Overlaps with existing project
        '2024-01-25'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.temporalConflicts).toHaveLength(1);
    });

    it('should detect temporal overlap - end date overlap', async () => {
      const mockResult = {
        rows: [createMockProject('overlap-2', '2024-01-20', '2024-01-30')]
      };

      mockDb.query
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testGeometry,
        '2024-01-10',
        '2024-01-25' // Overlaps with existing project
      );

      expect(result.hasConflict).toBe(true);
      expect(result.temporalConflicts).toHaveLength(1);
    });

    it('should detect temporal overlap - complete containment', async () => {
      const mockResult = {
        rows: [createMockProject('overlap-3', '2024-01-15', '2024-01-20')]
      };

      mockDb.query
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testGeometry,
        '2024-01-10', // Contains existing project completely
        '2024-01-25'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.temporalConflicts).toHaveLength(1);
    });

    it('should detect temporal overlap - exact same dates', async () => {
      const mockResult = {
        rows: [createMockProject('overlap-4', '2024-01-15', '2024-01-25')]
      };

      mockDb.query
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testGeometry,
        '2024-01-15', // Exact same dates
        '2024-01-25'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.temporalConflicts).toHaveLength(1);
    });

    it('should not detect temporal overlap - adjacent dates', async () => {
      const mockResult = {
        rows: [createMockProject('no-overlap-1', '2024-01-01', '2024-01-14')]
      };

      mockDb.query
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testGeometry,
        '2024-01-15', // Starts day after existing project ends
        '2024-01-25'
      );

      expect(result.hasConflict).toBe(true); // Still spatial conflict
      expect(result.temporalConflicts).toHaveLength(0); // But no temporal overlap
    });

    it('should not detect temporal overlap - completely separate periods', async () => {
      const mockResult = {
        rows: [createMockProject('no-overlap-2', '2024-01-01', '2024-01-10')]
      };

      mockDb.query
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testGeometry,
        '2024-02-01', // Completely separate time period
        '2024-02-10'
      );

      expect(result.hasConflict).toBe(true); // Spatial conflict exists
      expect(result.temporalConflicts).toHaveLength(0); // No temporal overlap
    });

    it('should handle multiple temporal conflicts', async () => {
      const mockResult = {
        rows: [
          createMockProject('multi-1', '2024-01-10', '2024-01-20'),
          createMockProject('multi-2', '2024-01-18', '2024-01-28'),
          createMockProject('multi-3', '2024-01-25', '2024-02-05')
        ]
      };

      mockDb.query
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testGeometry,
        '2024-01-15',
        '2024-01-30'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.spatialConflicts).toHaveLength(3);
      expect(result.temporalConflicts).toHaveLength(3); // All three overlap temporally
    });
  });

  describe('Moratorium Violation Detection', () => {
    const testGeometry: GeoJSON.Point = {
      type: 'Point',
      coordinates: [14.4378, 50.0755]
    };

    const mockMoratorium: Moratorium = {
      id: 'moratorium-1',
      name: 'Test Moratorium',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [14.4370, 50.0750],
          [14.4380, 50.0750],
          [14.4380, 50.0760],
          [14.4370, 50.0760],
          [14.4370, 50.0750]
        ]]
      },
      reason: 'Road reconstruction',
      reasonDetail: 'Major road work',
      validFrom: new Date('2024-01-01'),
      validTo: new Date('2024-12-31'),
      exceptions: undefined,
      createdBy: 'coordinator-1',
      municipalityCode: 'CZ0201',
      createdAt: new Date()
    };

    it('should detect moratorium violations', async () => {
      const mockMoratoriumResult = {
        rows: [{
          id: 'moratorium-1',
          name: 'Test Moratorium',
          geometry: mockMoratorium.geometry,
          reason: 'Road reconstruction',
          reason_detail: 'Major road work',
          valid_from: '2024-01-01',
          valid_to: '2024-12-31',
          exceptions: null,
          created_by: 'coordinator-1',
          municipality_code: 'CZ0201',
          created_at: new Date()
        }]
      };

      // Mock the moratorium model method
      jest.spyOn(moratoriumModel, 'checkViolations').mockResolvedValue([mockMoratorium]);

      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No spatial conflicts
        .mockResolvedValueOnce(mockMoratoriumResult); // Moratorium violations

      const result = await conflictService.detectConflicts(
        testGeometry,
        '2024-06-01',
        '2024-06-30'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.moratoriumViolations).toHaveLength(1);
      expect(result.moratoriumViolations[0]?.name).toBe('Test Moratorium');
    });

    it('should handle no moratorium violations', async () => {
      jest.spyOn(moratoriumModel, 'checkViolations').mockResolvedValue([]);

      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testGeometry,
        '2024-06-01',
        '2024-06-30'
      );

      expect(result.hasConflict).toBe(false);
      expect(result.moratoriumViolations).toHaveLength(0);
    });

    it('should detect both spatial conflicts and moratorium violations', async () => {
      const mockProjectResult = {
        rows: [{
          id: 'conflict-project',
          name: 'Conflicting Project',
          applicant_id: 'user-2',
          contractor_organization: 'Other Contractor',
          contractor_contact: null,
          state: 'approved',
          start_date: '2024-06-01',
          end_date: '2024-06-30',
          geometry: testGeometry,
          work_type: 'Test Work',
          work_category: 'Test Category',
          description: 'Conflicting project',
          has_conflict: false,
          conflicting_project_ids: [],
          affected_municipalities: ['CZ0201'],
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      // Mock the moratorium model's checkViolations method directly on the service's instance
      jest.spyOn(conflictService['moratoriumModel'], 'checkViolations').mockResolvedValue([mockMoratorium]);
      
      // Mock spatial conflicts query
      mockDb.query
        .mockResolvedValueOnce(mockProjectResult);

      const result = await conflictService.detectConflicts(
        testGeometry,
        '2024-06-15',
        '2024-06-25'
      );

      expect(result.hasConflict).toBe(true);
      expect(result.spatialConflicts).toHaveLength(1);
      expect(result.temporalConflicts).toHaveLength(1);
      expect(result.moratoriumViolations).toHaveLength(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    const testGeometry: GeoJSON.Point = {
      type: 'Point',
      coordinates: [14.4378, 50.0755]
    };

    it('should handle database errors gracefully', async () => {
      // Clear any previous mock configurations
      jest.clearAllMocks();
      
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        conflictService.detectConflicts(testGeometry, '2024-01-15', '2024-01-25')
      ).rejects.toThrow('Failed to detect conflicts');
    });

    it('should handle invalid date formats', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // Should not throw error for invalid dates - let database handle validation
      const result = await conflictService.detectConflicts(
        testGeometry,
        'invalid-date',
        '2024-01-25'
      );

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should handle empty geometry', async () => {
      const emptyGeometry: GeoJSON.Point = {
        type: 'Point',
        coordinates: []
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        emptyGeometry,
        '2024-01-15',
        '2024-01-25'
      );

      expect(result.hasConflict).toBe(false);
    });

    it('should handle null/undefined geometry coordinates', async () => {
      const nullGeometry = {
        type: 'Point' as const,
        coordinates: null as any
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        nullGeometry,
        '2024-01-15',
        '2024-01-25'
      );

      expect(result.hasConflict).toBe(false);
    });

    it('should handle very large date ranges', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testGeometry,
        '1900-01-01',
        '2100-12-31'
      );

      expect(result.hasConflict).toBe(false);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['1900-01-01', '2100-12-31'])
      );
    });

    it('should handle projects with different states correctly', async () => {
      const mockResult = {
        rows: [
          {
            id: 'draft-project',
            name: 'Draft Project',
            applicant_id: 'user-1',
            state: 'draft', // Should not be included in conflicts
            start_date: '2024-01-15',
            end_date: '2024-01-25',
            geometry: testGeometry,
            work_type: 'Test',
            work_category: 'Test',
            has_conflict: false,
            conflicting_project_ids: [],
            affected_municipalities: [],
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      };

      mockDb.query
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [] });

      const result = await conflictService.detectConflicts(
        testGeometry,
        '2024-01-20',
        '2024-01-30'
      );

      // Should only check approved, in_progress, pending_approval states
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("state IN ('approved', 'in_progress', 'pending_approval')"),
        expect.any(Array)
      );
    });
  });

  describe('Conflict Status Updates', () => {
    const testGeometry: GeoJSON.Point = {
      type: 'Point',
      coordinates: [14.4378, 50.0755]
    };

    const mockConflictResult: ConflictDetectionResult = {
      hasConflict: true,
      spatialConflicts: [{
        id: 'conflict-1',
        name: 'Conflicting Project',
        applicantId: 'user-2',
        contractorOrganization: 'Test Contractor',
        contractorContact: undefined,
        state: 'approved',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-25'),
        geometry: testGeometry,
        workType: 'Test Work',
        workCategory: 'Test Category',
        description: 'Test project',
        hasConflict: false,
        conflictingProjectIds: [],
        affectedMunicipalities: ['CZ0201'],
        createdAt: new Date(),
        updatedAt: new Date()
      }],
      temporalConflicts: [],
      moratoriumViolations: []
    };

    beforeEach(() => {
      // Clear all mocks before each test in this describe block
      jest.clearAllMocks();
    });

    it('should update project conflict status', async () => {
      // Mock the project model methods directly on the service's instance
      jest.spyOn(conflictService['projectModel'], 'updateConflictStatus').mockResolvedValue();

      await conflictService.updateProjectConflictStatus('project-1', mockConflictResult);

      expect(conflictService['projectModel'].updateConflictStatus).toHaveBeenCalledWith(
        'project-1',
        true,
        ['conflict-1']
      );
    });

    it('should update conflicting projects bidirectionally', async () => {
      // Clear all previous mocks
      jest.clearAllMocks();

      const mockUpdateConflictStatus = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(conflictService['projectModel'], 'updateConflictStatus').mockImplementation(mockUpdateConflictStatus);

      // Ensure mockConflictResult has proper structure for this test
      const testConflictResult: ConflictDetectionResult = {
        hasConflict: true,
        spatialConflicts: [{
          id: 'conflict-1',
          name: 'Conflicting Project',
          applicantId: 'user-2',
          contractorOrganization: 'Test Contractor',
          contractorContact: undefined,
          state: 'approved',
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-25'),
          geometry: testGeometry,
          workType: 'Test Work',
          workCategory: 'Test Category',
          description: 'Test project',
          hasConflict: false,
          conflictingProjectIds: [], // Empty array means project-1 should be added
          affectedMunicipalities: ['CZ0201'],
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        temporalConflicts: [],
        moratoriumViolations: []
      };

      await conflictService.updateProjectConflictStatus('project-1', testConflictResult);

      // Should update both the original project and the conflicting project
      expect(mockUpdateConflictStatus).toHaveBeenCalledTimes(2);
      expect(mockUpdateConflictStatus).toHaveBeenNthCalledWith(1,
        'project-1',
        true,
        ['conflict-1']
      );
      expect(mockUpdateConflictStatus).toHaveBeenNthCalledWith(2,
        'conflict-1',
        true,
        ['project-1'] // The conflicting project gets the original project ID added
      );
    });

    it('should not duplicate conflict IDs', async () => {
      const conflictResultWithExisting: ConflictDetectionResult = {
        ...mockConflictResult,
        spatialConflicts: [{
          ...mockConflictResult.spatialConflicts[0]!,
          conflictingProjectIds: ['project-1'] // Already has this project as conflict
        }]
      };

      jest.spyOn(conflictService['projectModel'], 'updateConflictStatus').mockResolvedValue();

      await conflictService.updateProjectConflictStatus('project-1', conflictResultWithExisting);

      // Should only update the original project, not the conflicting one since it already has the ID
      expect(conflictService['projectModel'].updateConflictStatus).toHaveBeenCalledTimes(1);
      expect(conflictService['projectModel'].updateConflictStatus).toHaveBeenCalledWith(
        'project-1',
        true,
        ['conflict-1']
      );
    });
  });

  describe('Buffer Creation', () => {
    const testGeometry: GeoJSON.Point = {
      type: 'Point',
      coordinates: [14.4378, 50.0755]
    };

    it('should create buffer around geometry', async () => {
      const bufferedGeometry: GeoJSON.Polygon = {
        type: 'Polygon',
        coordinates: [[
          [14.4370, 50.0750],
          [14.4380, 50.0750],
          [14.4380, 50.0760],
          [14.4370, 50.0760],
          [14.4370, 50.0750]
        ]]
      };

      mockDb.query.mockResolvedValue({
        rows: [{ buffered_geometry: bufferedGeometry }]
      });

      const result = await conflictService.createBuffer(testGeometry, 50);

      expect(result).toEqual(bufferedGeometry);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ST_Buffer'),
        [JSON.stringify(testGeometry), 50]
      );
    });

    it('should handle buffer creation errors', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await conflictService.createBuffer(testGeometry, 50);

      expect(result).toBeUndefined();
    });
  });
});