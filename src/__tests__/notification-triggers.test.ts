import { NotificationTriggers } from '../services/NotificationTriggers';
import { NotificationService } from '../services/NotificationService';
import { ConflictDetectionService } from '../services/ConflictDetectionService';
import { deadlineScheduler } from '../services/DeadlineScheduler';
import { Project, ProjectState, User, ProjectComment, Moratorium } from '../types';

// Mock the dependencies
jest.mock('../services/NotificationService');
jest.mock('../services/ConflictDetectionService');
jest.mock('../services/DeadlineScheduler');
jest.mock('../config/database', () => ({
  pool: {}
}));

describe('NotificationTriggers', () => {
  const mockProject: Project = {
    id: 'test-project-id',
    name: 'Test Project',
    applicantId: 'test-user-id',
    contractorOrganization: 'Test Contractor',
    contractorContact: {
      name: 'John Doe',
      phone: '+420123456789',
      email: 'john@example.com'
    },
    state: 'draft',
    startDate: new Date('2024-01-15'),
    endDate: new Date('2024-01-20'),
    geometry: {
      type: 'Point',
      coordinates: [14.4378, 50.0755]
    },
    workType: 'Výkop pro kanalizaci',
    workCategory: 'infrastructure',
    description: 'Test excavation project',
    hasConflict: false,
    conflictingProjectIds: [],
    affectedMunicipalities: ['Praha'],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    organization: 'Test Organization',
    role: 'applicant',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockComment: ProjectComment = {
    id: 'test-comment-id',
    projectId: 'test-project-id',
    userId: 'test-user-id',
    content: 'Test comment',
    createdAt: new Date()
  };

  const mockMoratorium: Moratorium = {
    id: 'test-moratorium-id',
    name: 'Test Moratorium',
    geometry: {
      type: 'Polygon',
      coordinates: [[[14.4, 50.0], [14.5, 50.0], [14.5, 50.1], [14.4, 50.1], [14.4, 50.0]]]
    },
    reason: 'road_reconstruction',
    reasonDetail: 'Test moratorium for road reconstruction',
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2024-12-31'),
    exceptions: null,
    createdBy: 'test-user-id',
    municipalityCode: 'Praha',
    createdAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('onProjectCreated', () => {
    it('should trigger notification for pending approval projects', async () => {
      const pendingProject = { ...mockProject, state: 'pending_approval' as ProjectState };
      const mockNotifyProjectSubmitted = jest.spyOn(NotificationService, 'notifyProjectSubmitted').mockResolvedValue();

      await NotificationTriggers.onProjectCreated(pendingProject);

      expect(mockNotifyProjectSubmitted).toHaveBeenCalledWith(pendingProject);
    });

    it('should not trigger notification for draft projects', async () => {
      const mockNotifyProjectSubmitted = jest.spyOn(NotificationService, 'notifyProjectSubmitted').mockResolvedValue();

      await NotificationTriggers.onProjectCreated(mockProject);

      expect(mockNotifyProjectSubmitted).not.toHaveBeenCalled();
    });
  });

  describe('onProjectStateChanged', () => {
    it('should trigger state change notification', async () => {
      const mockNotifyStateChanged = jest.spyOn(NotificationService, 'notifyProjectStateChanged').mockResolvedValue();
      const approvedProject = { ...mockProject, state: 'approved' as ProjectState };

      await NotificationTriggers.onProjectStateChanged(approvedProject, 'pending_approval', 'test-user-id');

      expect(mockNotifyStateChanged).toHaveBeenCalledWith(approvedProject, 'pending_approval');
    });

    it('should run conflict detection when project is submitted for approval', async () => {
      const mockNotifyStateChanged = jest.spyOn(NotificationService, 'notifyProjectStateChanged').mockResolvedValue();
      const pendingProject = { ...mockProject, state: 'pending_approval' as ProjectState };

      // Mock the ConflictDetectionService
      const mockDetectConflicts = jest.fn().mockResolvedValue({
        hasConflict: false,
        spatialConflicts: [],
        temporalConflicts: []
      });
      
      jest.mocked(ConflictDetectionService).mockImplementation(() => ({
        detectConflicts: mockDetectConflicts
      } as any));

      await NotificationTriggers.onProjectStateChanged(pendingProject, 'draft', 'test-user-id');

      expect(mockNotifyStateChanged).toHaveBeenCalledWith(pendingProject, 'draft');
    });

    it('should trigger project started notification when moving to in_progress', async () => {
      const mockNotifyStateChanged = jest.spyOn(NotificationService, 'notifyProjectStateChanged').mockResolvedValue();
      const mockNotifyProjectStarted = jest.spyOn(NotificationService, 'notifyProjectStarted' as any).mockResolvedValue();
      const inProgressProject = { ...mockProject, state: 'in_progress' as ProjectState };

      await NotificationTriggers.onProjectStateChanged(inProgressProject, 'approved', 'test-user-id');

      expect(mockNotifyStateChanged).toHaveBeenCalledWith(inProgressProject, 'approved');
      expect(mockNotifyProjectStarted).toHaveBeenCalledWith(inProgressProject);
    });

    it('should trigger project completed notification when moving to completed', async () => {
      const mockNotifyStateChanged = jest.spyOn(NotificationService, 'notifyProjectStateChanged').mockResolvedValue();
      const mockNotifyProjectCompleted = jest.spyOn(NotificationService, 'notifyProjectCompleted' as any).mockResolvedValue();
      const completedProject = { ...mockProject, state: 'completed' as ProjectState };

      await NotificationTriggers.onProjectStateChanged(completedProject, 'in_progress', 'test-user-id');

      expect(mockNotifyStateChanged).toHaveBeenCalledWith(completedProject, 'in_progress');
      expect(mockNotifyProjectCompleted).toHaveBeenCalledWith(completedProject);
    });
  });

  describe('onCommentAdded', () => {
    it('should trigger comment notification', async () => {
      const mockNotifyCommentAdded = jest.spyOn(NotificationService, 'notifyCommentAdded').mockResolvedValue();

      await NotificationTriggers.onCommentAdded(mockProject, mockComment, mockUser);

      expect(mockNotifyCommentAdded).toHaveBeenCalledWith(mockProject, mockComment, mockUser);
    });
  });

  describe('onMoratoriumCreated', () => {
    it('should trigger moratorium notification', async () => {
      const mockNotifyMoratoriumCreated = jest.spyOn(NotificationService, 'notifyMoratoriumCreated').mockResolvedValue();

      await NotificationTriggers.onMoratoriumCreated(mockMoratorium);

      expect(mockNotifyMoratoriumCreated).toHaveBeenCalledWith(mockMoratorium);
    });
  });

  describe('onUserRegistered', () => {
    it('should trigger user registration notification', async () => {
      const mockNotifyUserRegistered = jest.spyOn(NotificationService, 'notifyUserRegistered').mockResolvedValue();

      await NotificationTriggers.onUserRegistered(mockUser);

      expect(mockNotifyUserRegistered).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('onConflictsDetected', () => {
    it('should trigger conflict notification when conflicts exist', async () => {
      const mockNotifyConflictDetected = jest.spyOn(NotificationService, 'notifyConflictDetected').mockResolvedValue();
      const conflicts = [{ ...mockProject, id: 'conflict-project-id' }];

      await NotificationTriggers.onConflictsDetected(mockProject, conflicts);

      expect(mockNotifyConflictDetected).toHaveBeenCalledWith(mockProject, conflicts);
    });

    it('should not trigger notification when no conflicts exist', async () => {
      const mockNotifyConflictDetected = jest.spyOn(NotificationService, 'notifyConflictDetected').mockResolvedValue();

      await NotificationTriggers.onConflictsDetected(mockProject, []);

      expect(mockNotifyConflictDetected).not.toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should start the deadline scheduler', () => {
      const mockStart = jest.spyOn(deadlineScheduler, 'start').mockImplementation();

      NotificationTriggers.initialize();

      expect(mockStart).toHaveBeenCalled();
    });
  });

  describe('triggerDeadlineCheck', () => {
    it('should trigger manual deadline check', async () => {
      const mockTriggerManualCheck = jest.spyOn(deadlineScheduler, 'triggerManualCheck').mockResolvedValue({
        success: true,
        message: 'Manual deadline check completed'
      });

      await NotificationTriggers.triggerDeadlineCheck();

      expect(mockTriggerManualCheck).toHaveBeenCalled();
    });
  });

  describe('getSystemStatus', () => {
    it('should return system status', () => {
      const mockGetQueueStatus = jest.spyOn(NotificationService, 'getQueueStatus').mockReturnValue({
        pending: 5,
        failed: 1
      });
      
      const mockGetStatus = jest.spyOn(deadlineScheduler, 'getStatus').mockReturnValue({
        isRunning: true,
        nextRun: new Date()
      });

      const status = NotificationTriggers.getSystemStatus();

      expect(status).toEqual({
        queueStatus: { pending: 5, failed: 1 },
        schedulerStatus: { isRunning: true, nextRun: expect.any(Date) },
        isInitialized: true
      });

      expect(mockGetQueueStatus).toHaveBeenCalled();
      expect(mockGetStatus).toHaveBeenCalled();
    });
  });
});