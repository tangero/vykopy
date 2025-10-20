import { NotificationService } from './NotificationService';
import { ConflictDetectionService } from './ConflictDetectionService';
import { deadlineScheduler } from './DeadlineScheduler';
import { Project, ProjectState, User, ProjectComment, Moratorium } from '../types';

/**
 * Notification triggers that should be called when specific events occur
 * These functions should be integrated into the appropriate service methods
 */
export class NotificationTriggers {

  /**
   * Trigger notifications when a project is created
   */
  static async onProjectCreated(project: Project): Promise<void> {
    try {
      // If project is submitted for approval, notify coordinators
      if (project.state === 'pending_approval') {
        await NotificationService.notifyProjectSubmitted(project);
      }

      console.log(`🔔 Project creation triggers executed for: ${project.name}`);
    } catch (error) {
      console.error('Failed to execute project creation triggers:', error);
    }
  }

  /**
   * Trigger notifications when a project state changes
   */
  static async onProjectStateChanged(
    project: Project, 
    oldState: ProjectState, 
    userId: string
  ): Promise<void> {
    try {
      // Send state change notification
      await NotificationService.notifyProjectStateChanged(project, oldState);

      // If project is submitted for approval, run conflict detection
      if (project.state === 'pending_approval' && oldState !== 'pending_approval') {
        await this.runConflictDetectionAndNotify(project);
      }

      // If project is approved, schedule deadline notifications
      if (project.state === 'approved' && oldState !== 'approved') {
        await this.scheduleDeadlineNotifications(project);
      }

      // If project moves to in_progress, send immediate notification to coordinators
      if (project.state === 'in_progress' && oldState === 'approved') {
        await NotificationService.notifyProjectStarted(project);
      }

      // If project is completed, send completion notification
      if (project.state === 'completed' && oldState === 'in_progress') {
        await NotificationService.notifyProjectCompleted(project);
      }

      console.log(`🔔 Project state change triggers executed for: ${project.name} (${oldState} → ${project.state})`);
    } catch (error) {
      console.error('Failed to execute project state change triggers:', error);
    }
  }

  /**
   * Trigger notifications when a project is updated
   */
  static async onProjectUpdated(
    project: Project, 
    oldProject: Project, 
    userId: string
  ): Promise<void> {
    try {
      // Check if geometry or dates changed and project is approved/in-progress
      const geometryChanged = JSON.stringify(project.geometry) !== JSON.stringify(oldProject.geometry);
      const datesChanged = project.startDate.getTime() !== oldProject.startDate.getTime() || 
                          project.endDate.getTime() !== oldProject.endDate.getTime();
      
      if ((geometryChanged || datesChanged) && 
          ['approved', 'in_progress'].includes(project.state)) {
        // Re-run conflict detection for significant changes
        await this.runConflictDetectionAndNotify(project);
        
        // If dates changed for approved project, reschedule deadline notifications
        if (datesChanged && project.state === 'approved') {
          await this.scheduleDeadlineNotifications(project);
        }
      }

      // Send general update notification to coordinators if project is in review
      if (['pending_approval', 'approved', 'in_progress'].includes(project.state)) {
        await NotificationService.notifyProjectUpdated(project, oldProject);
      }

      console.log(`🔔 Project update triggers executed for: ${project.name}`);
    } catch (error) {
      console.error('Failed to execute project update triggers:', error);
    }
  }

  /**
   * Trigger notifications when a comment is added
   */
  static async onCommentAdded(
    project: Project, 
    comment: ProjectComment, 
    commentAuthor: User
  ): Promise<void> {
    try {
      await NotificationService.notifyCommentAdded(project, comment, commentAuthor);

      console.log(`🔔 Comment triggers executed for project: ${project.name}`);
    } catch (error) {
      console.error('Failed to execute comment triggers:', error);
    }
  }

  /**
   * Trigger notifications when a moratorium is created
   */
  static async onMoratoriumCreated(moratorium: Moratorium): Promise<void> {
    try {
      await NotificationService.notifyMoratoriumCreated(moratorium);

      console.log(`🔔 Moratorium creation triggers executed for: ${moratorium.name}`);
    } catch (error) {
      console.error('Failed to execute moratorium creation triggers:', error);
    }
  }

  /**
   * Trigger notifications when a user registers
   */
  static async onUserRegistered(user: User): Promise<void> {
    try {
      await NotificationService.notifyUserRegistered(user);

      console.log(`🔔 User registration triggers executed for: ${user.email}`);
    } catch (error) {
      console.error('Failed to execute user registration triggers:', error);
    }
  }

  /**
   * Trigger notifications when conflicts are detected
   */
  static async onConflictsDetected(project: Project, conflicts: Project[]): Promise<void> {
    try {
      if (conflicts.length > 0) {
        await NotificationService.notifyConflictDetected(project, conflicts);
      }

      console.log(`🔔 Conflict detection triggers executed for: ${project.name} (${conflicts.length} conflicts)`);
    } catch (error) {
      console.error('Failed to execute conflict detection triggers:', error);
    }
  }

  /**
   * Run conflict detection and notify if conflicts are found
   */
  private static async runConflictDetectionAndNotify(project: Project): Promise<void> {
    try {
      const conflictService = new ConflictDetectionService(require('../config/database').pool);
      const startDate = project.startDate.toISOString().split('T')[0];
      const endDate = project.endDate.toISOString().split('T')[0];
      
      const conflictResult = await conflictService.detectConflicts(
        project.geometry,
        startDate!,
        endDate!,
        project.id
      );

      if (conflictResult.hasConflict) {
        const allConflicts = [
          ...conflictResult.spatialConflicts,
          ...conflictResult.temporalConflicts
        ];

        // Remove duplicates
        const uniqueConflicts = allConflicts.filter((conflict, index, self) => 
          index === self.findIndex(c => c.id === conflict.id)
        );

        // Update project with conflict information
        const ProjectModel = require('../models/Project').ProjectModel;
        const projectModel = new ProjectModel(require('../config/database').pool);
        await projectModel.updateConflictStatus(project.id, true, uniqueConflicts.map(c => c.id));

        // Send conflict notifications
        await this.onConflictsDetected(project, uniqueConflicts);
      } else {
        // Clear conflict status if no conflicts found
        const ProjectModel = require('../models/Project').ProjectModel;
        const projectModel = new ProjectModel(require('../config/database').pool);
        await projectModel.updateConflictStatus(project.id, false, []);
      }
    } catch (error) {
      console.error('Failed to run conflict detection and notify:', error);
    }
  }

  /**
   * Initialize notification system
   * This should be called when the application starts
   */
  static initialize(): void {
    try {
      // Start the deadline scheduler
      deadlineScheduler.start();

      console.log('✅ Notification system initialized');
    } catch (error) {
      console.error('Failed to initialize notification system:', error);
    }
  }

  /**
   * Manual trigger for deadline checks (useful for testing or manual runs)
   */
  static async triggerDeadlineCheck(): Promise<void> {
    try {
      const result = await deadlineScheduler.triggerManualCheck();
      if (result.success) {
        console.log('✅ Manual deadline check completed');
      } else {
        console.error('❌ Manual deadline check failed:', result.message);
      }
    } catch (error) {
      console.error('Failed to execute manual deadline check:', error);
    }
  }

  /**
   * Schedule deadline notifications for an approved project
   */
  private static async scheduleDeadlineNotifications(project: Project): Promise<void> {
    try {
      const now = new Date();
      const startDate = new Date(project.startDate);
      const endDate = new Date(project.endDate);
      
      // Calculate notification dates (7 days and 3 days before start)
      const sevenDaysBefore = new Date(startDate.getTime() - (7 * 24 * 60 * 60 * 1000));
      const threeDaysBefore = new Date(startDate.getTime() - (3 * 24 * 60 * 60 * 1000));
      const oneDayBefore = new Date(startDate.getTime() - (1 * 24 * 60 * 60 * 1000));

      // Schedule 7-day notification if it's in the future
      if (sevenDaysBefore > now) {
        deadlineScheduler.scheduleOneTimeCheck(sevenDaysBefore);
        console.log(`📅 Scheduled 7-day deadline notification for project: ${project.name} at ${sevenDaysBefore.toISOString()}`);
      }

      // Schedule 3-day notification if it's in the future
      if (threeDaysBefore > now) {
        deadlineScheduler.scheduleOneTimeCheck(threeDaysBefore);
        console.log(`📅 Scheduled 3-day deadline notification for project: ${project.name} at ${threeDaysBefore.toISOString()}`);
      }

      // Schedule 1-day notification if it's in the future
      if (oneDayBefore > now) {
        deadlineScheduler.scheduleOneTimeCheck(oneDayBefore);
        console.log(`📅 Scheduled 1-day deadline notification for project: ${project.name} at ${oneDayBefore.toISOString()}`);
      }

      // Schedule end date reminder (1 day before project should end)
      const oneDayBeforeEnd = new Date(endDate.getTime() - (1 * 24 * 60 * 60 * 1000));
      if (oneDayBeforeEnd > now) {
        deadlineScheduler.scheduleOneTimeCheck(oneDayBeforeEnd);
        console.log(`📅 Scheduled end deadline notification for project: ${project.name} at ${oneDayBeforeEnd.toISOString()}`);
      }

      // If project starts within 7 days, send immediate notification
      const daysUntilStart = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilStart <= 7 && daysUntilStart > 0) {
        await NotificationService.notifyDeadlineApproaching(project, daysUntilStart);
        console.log(`⚡ Sent immediate deadline notification for project: ${project.name} (${daysUntilStart} days)`);
      }
    } catch (error) {
      console.error('Failed to schedule deadline notifications:', error);
    }
  }

  /**
   * Trigger notifications for projects with approaching deadlines
   * This method is called by the deadline scheduler
   */
  static async onDeadlineApproaching(): Promise<void> {
    try {
      await NotificationService.checkApproachingDeadlines();
      console.log('🔔 Deadline approaching notifications processed');
    } catch (error) {
      console.error('Failed to process deadline approaching notifications:', error);
    }
  }

  /**
   * Get notification system status
   */
  static getSystemStatus(): {
    queueStatus: { pending: number; failed: number };
    schedulerStatus: { isRunning: boolean; nextRun?: Date };
    isInitialized: boolean;
  } {
    return {
      queueStatus: NotificationService.getQueueStatus(),
      schedulerStatus: deadlineScheduler.getStatus(),
      isInitialized: true, // Could be enhanced to track actual initialization state
    };
  }
}

// Export for easy access
export const notificationTriggers = NotificationTriggers;