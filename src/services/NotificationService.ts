import { emailService, NotificationType, NotificationData } from './EmailService';
import { UserModel } from '../models/User';
import { ProjectModel } from '../models/Project';
import { User, Project, ProjectComment, Moratorium, ProjectState } from '../types';

export class NotificationService {
  
  /**
   * Send notification when a new project is submitted for approval
   */
  static async notifyProjectSubmitted(project: Project): Promise<void> {
    try {
      // Get the applicant
      const applicant = await UserModel.findById(project.applicantId);
      if (!applicant) {
        console.error('Applicant not found for project:', project.id);
        return;
      }

      // Find municipal coordinators for affected municipalities
      const coordinators = await this.getMunicipalCoordinators(project.affectedMunicipalities);
      
      // Send notifications to coordinators
      for (const coordinator of coordinators) {
        const notificationData: NotificationData = {
          user: coordinator,
          project,
        };

        await emailService.queueEmail(
          coordinator.email,
          'project_submitted',
          notificationData
        );
      }

      console.log(`✅ Project submission notifications sent for project: ${project.name}`);
    } catch (error) {
      console.error('Failed to send project submission notifications:', error);
    }
  }

  /**
   * Send notification when a project is approved
   */
  static async notifyProjectApproved(project: Project): Promise<void> {
    try {
      const applicant = await UserModel.findById(project.applicantId);
      if (!applicant) {
        console.error('Applicant not found for project:', project.id);
        return;
      }

      const notificationData: NotificationData = {
        user: applicant,
        project,
      };

      await emailService.queueEmail(
        applicant.email,
        'project_approved',
        notificationData
      );

      console.log(`✅ Project approval notification sent for project: ${project.name}`);
    } catch (error) {
      console.error('Failed to send project approval notification:', error);
    }
  }

  /**
   * Send notification when a project is rejected
   */
  static async notifyProjectRejected(project: Project): Promise<void> {
    try {
      const applicant = await UserModel.findById(project.applicantId);
      if (!applicant) {
        console.error('Applicant not found for project:', project.id);
        return;
      }

      const notificationData: NotificationData = {
        user: applicant,
        project,
      };

      await emailService.queueEmail(
        applicant.email,
        'project_rejected',
        notificationData
      );

      console.log(`✅ Project rejection notification sent for project: ${project.name}`);
    } catch (error) {
      console.error('Failed to send project rejection notification:', error);
    }
  }

  /**
   * Send notification when project state changes
   */
  static async notifyProjectStateChanged(project: Project, oldState: ProjectState): Promise<void> {
    try {
      // Handle specific state changes
      switch (project.state) {
        case 'approved':
          await this.notifyProjectApproved(project);
          break;
        case 'rejected':
          await this.notifyProjectRejected(project);
          break;
        case 'pending_approval':
          await this.notifyProjectSubmitted(project);
          break;
        default:
          // For other state changes, notify the applicant
          const applicant = await UserModel.findById(project.applicantId);
          if (applicant) {
            const notificationData: NotificationData = {
              user: applicant,
              project,
            };

            await emailService.queueEmail(
              applicant.email,
              'project_state_changed',
              notificationData
            );
          }
          break;
      }

      console.log(`✅ State change notification sent for project: ${project.name} (${oldState} → ${project.state})`);
    } catch (error) {
      console.error('Failed to send project state change notification:', error);
    }
  }

  /**
   * Send notification when conflicts are detected
   */
  static async notifyConflictDetected(project: Project, conflicts: Project[]): Promise<void> {
    try {
      // Notify the applicant
      const applicant = await UserModel.findById(project.applicantId);
      if (applicant) {
        const notificationData: NotificationData = {
          user: applicant,
          project,
          conflicts,
        };

        await emailService.queueEmail(
          applicant.email,
          'conflict_detected',
          notificationData
        );
      }

      // Notify municipal coordinators for affected municipalities
      const coordinators = await this.getMunicipalCoordinators(project.affectedMunicipalities);
      
      for (const coordinator of coordinators) {
        const notificationData: NotificationData = {
          user: coordinator,
          project,
          conflicts,
        };

        await emailService.queueEmail(
          coordinator.email,
          'conflict_detected',
          notificationData
        );
      }

      // Also notify applicants of conflicting projects
      for (const conflictProject of conflicts) {
        const conflictApplicant = await UserModel.findById(conflictProject.applicantId);
        if (conflictApplicant && conflictApplicant.id !== project.applicantId) {
          const notificationData: NotificationData = {
            user: conflictApplicant,
            project: conflictProject,
            conflicts: [project], // Show the new conflicting project
          };

          await emailService.queueEmail(
            conflictApplicant.email,
            'conflict_detected',
            notificationData
          );
        }
      }

      console.log(`✅ Conflict detection notifications sent for project: ${project.name}`);
    } catch (error) {
      console.error('Failed to send conflict detection notifications:', error);
    }
  }

  /**
   * Send notification when a comment is added to a project
   */
  static async notifyCommentAdded(project: Project, comment: ProjectComment, commentAuthor: User): Promise<void> {
    try {
      const recipients = new Set<string>();

      // Always notify the project applicant (unless they wrote the comment)
      const applicant = await UserModel.findById(project.applicantId);
      if (applicant && applicant.id !== commentAuthor.id) {
        recipients.add(applicant.email);
      }

      // Notify municipal coordinators for affected municipalities (unless they wrote the comment)
      const coordinators = await this.getMunicipalCoordinators(project.affectedMunicipalities);
      for (const coordinator of coordinators) {
        if (coordinator.id !== commentAuthor.id) {
          recipients.add(coordinator.email);
        }
      }

      // Send notifications to all recipients
      for (const email of recipients) {
        // Find the user for this email to get their details
        const user = await UserModel.findByEmail(email);
        if (user) {
          const notificationData: NotificationData = {
            user,
            project,
            comment,
          };

          await emailService.queueEmail(
            email,
            'comment_added',
            notificationData
          );
        }
      }

      console.log(`✅ Comment notifications sent for project: ${project.name}`);
    } catch (error) {
      console.error('Failed to send comment notifications:', error);
    }
  }

  /**
   * Send notification when a deadline is approaching
   */
  static async notifyDeadlineApproaching(project: Project, daysUntilDeadline: number): Promise<void> {
    try {
      const applicant = await UserModel.findById(project.applicantId);
      if (!applicant) {
        console.error('Applicant not found for project:', project.id);
        return;
      }

      const notificationData: NotificationData = {
        user: applicant,
        project,
        additionalData: { daysUntilDeadline },
      };

      await emailService.queueEmail(
        applicant.email,
        'deadline_approaching',
        notificationData
      );

      // Also notify coordinators for approved projects
      if (project.state === 'approved') {
        const coordinators = await this.getMunicipalCoordinators(project.affectedMunicipalities);
        
        for (const coordinator of coordinators) {
          const coordinatorNotificationData: NotificationData = {
            user: coordinator,
            project,
            additionalData: { daysUntilDeadline },
          };

          await emailService.queueEmail(
            coordinator.email,
            'deadline_approaching',
            coordinatorNotificationData
          );
        }
      }

      console.log(`✅ Deadline approaching notifications sent for project: ${project.name} (${daysUntilDeadline} days)`);
    } catch (error) {
      console.error('Failed to send deadline approaching notifications:', error);
    }
  }

  /**
   * Send notification when a moratorium is created
   */
  static async notifyMoratoriumCreated(moratorium: Moratorium): Promise<void> {
    try {
      // Find all users who might be affected by this moratorium
      // This includes applicants and coordinators in the affected municipality
      const affectedUsers = await this.getUsersInMunicipality(moratorium.municipalityCode);
      
      for (const user of affectedUsers) {
        const notificationData: NotificationData = {
          user,
          moratorium,
        };

        await emailService.queueEmail(
          user.email,
          'moratorium_created',
          notificationData
        );
      }

      console.log(`✅ Moratorium creation notifications sent for: ${moratorium.name}`);
    } catch (error) {
      console.error('Failed to send moratorium creation notifications:', error);
    }
  }

  /**
   * Send notification when a project is updated
   */
  static async notifyProjectUpdated(project: Project, oldProject: Project): Promise<void> {
    try {
      // Notify municipal coordinators for affected municipalities
      const coordinators = await this.getMunicipalCoordinators(project.affectedMunicipalities);
      
      for (const coordinator of coordinators) {
        const notificationData: NotificationData = {
          user: coordinator,
          project,
          additionalData: { oldProject },
        };

        await emailService.queueEmail(
          coordinator.email,
          'project_state_changed', // Reuse existing template for updates
          notificationData
        );
      }

      console.log(`✅ Project update notifications sent for project: ${project.name}`);
    } catch (error) {
      console.error('Failed to send project update notifications:', error);
    }
  }

  /**
   * Send notification when a project is started (moves to in_progress)
   */
  static async notifyProjectStarted(project: Project): Promise<void> {
    try {
      // Notify municipal coordinators for affected municipalities
      const coordinators = await this.getMunicipalCoordinators(project.affectedMunicipalities);
      
      for (const coordinator of coordinators) {
        const notificationData: NotificationData = {
          user: coordinator,
          project,
        };

        await emailService.queueEmail(
          coordinator.email,
          'project_state_changed',
          notificationData
        );
      }

      console.log(`✅ Project started notifications sent for project: ${project.name}`);
    } catch (error) {
      console.error('Failed to send project started notifications:', error);
    }
  }

  /**
   * Send notification when a project is completed
   */
  static async notifyProjectCompleted(project: Project): Promise<void> {
    try {
      // Notify the applicant
      const applicant = await UserModel.findById(project.applicantId);
      if (applicant) {
        const notificationData: NotificationData = {
          user: applicant,
          project,
        };

        await emailService.queueEmail(
          applicant.email,
          'project_state_changed',
          notificationData
        );
      }

      // Notify municipal coordinators for affected municipalities
      const coordinators = await this.getMunicipalCoordinators(project.affectedMunicipalities);
      
      for (const coordinator of coordinators) {
        const notificationData: NotificationData = {
          user: coordinator,
          project,
        };

        await emailService.queueEmail(
          coordinator.email,
          'project_state_changed',
          notificationData
        );
      }

      console.log(`✅ Project completion notifications sent for project: ${project.name}`);
    } catch (error) {
      console.error('Failed to send project completion notifications:', error);
    }
  }

  /**
   * Send notification when a new user registers
   */
  static async notifyUserRegistered(newUser: User): Promise<void> {
    try {
      // Notify all regional administrators
      const { users: admins } = await UserModel.findAll({ role: 'regional_admin', isActive: true });
      
      for (const admin of admins) {
        const notificationData: NotificationData = {
          user: newUser, // The notification is about the new user
        };

        await emailService.queueEmail(
          admin.email,
          'user_registered',
          notificationData
        );
      }

      console.log(`✅ User registration notifications sent for: ${newUser.email}`);
    } catch (error) {
      console.error('Failed to send user registration notifications:', error);
    }
  }

  /**
   * Check for approaching deadlines and send notifications
   * This should be called by a scheduled job (e.g., daily cron job)
   */
  static async checkApproachingDeadlines(): Promise<void> {
    try {
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + (1 * 24 * 60 * 60 * 1000));
      const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
      const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

      const projectModel = new ProjectModel(require('../config/database').pool);
      
      // Projects starting in 1 day
      const { projects: projectsIn1Day } = await projectModel.findMany({
        state: 'approved',
        startDate: oneDayFromNow.toISOString().split('T')[0],
        limit: 100,
      });

      for (const project of projectsIn1Day) {
        await this.notifyDeadlineApproaching(project, 1);
      }

      // Projects starting in 3 days
      const { projects: projectsIn3Days } = await projectModel.findMany({
        state: 'approved',
        startDate: threeDaysFromNow.toISOString().split('T')[0],
        limit: 100,
      });

      for (const project of projectsIn3Days) {
        await this.notifyDeadlineApproaching(project, 3);
      }

      // Projects starting in 7 days
      const { projects: projectsIn7Days } = await projectModel.findMany({
        state: 'approved',
        startDate: sevenDaysFromNow.toISOString().split('T')[0],
        limit: 100,
      });

      for (const project of projectsIn7Days) {
        await this.notifyDeadlineApproaching(project, 7);
      }

      // Check for projects ending soon (in_progress projects ending in 1 day)
      const { projects: projectsEndingIn1Day } = await projectModel.findMany({
        state: 'in_progress',
        endDate: oneDayFromNow.toISOString().split('T')[0],
        limit: 100,
      });

      for (const project of projectsEndingIn1Day) {
        await this.notifyProjectEndingSoon(project, 1);
      }

      // Also check for overdue projects (started but not marked as in_progress)
      const overdueProjects = await this.checkOverdueProjects();
      for (const project of overdueProjects) {
        await this.notifyProjectOverdue(project);
      }

      // Check for projects that should have ended but are still in progress
      const overdueEndProjects = await this.checkOverdueEndProjects();
      for (const project of overdueEndProjects) {
        await this.notifyProjectOverdueEnd(project);
      }

      const totalNotifications = projectsIn1Day.length + projectsIn3Days.length + projectsIn7Days.length + 
                                projectsEndingIn1Day.length + overdueProjects.length + overdueEndProjects.length;
      console.log(`✅ Deadline check completed: ${totalNotifications} notifications sent`);
    } catch (error) {
      console.error('Failed to check approaching deadlines:', error);
    }
  }

  /**
   * Check for overdue projects (approved projects that should have started)
   */
  private static async checkOverdueProjects(): Promise<Project[]> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      
      // Use direct database query for overdue projects
      const pool = require('../config/database').pool;
      const query = `
        SELECT 
          id, name, applicant_id, contractor_organization, contractor_contact,
          state, start_date, end_date, ST_AsGeoJSON(geometry)::json as geometry,
          work_type, work_category, description, has_conflict, 
          conflicting_project_ids, affected_municipalities, created_at, updated_at
        FROM projects 
        WHERE state = 'approved' AND start_date < $1
        ORDER BY start_date ASC
        LIMIT 50
      `;
      
      const result = await pool.query(query, [yesterday.toISOString().split('T')[0]]);
      
      // Map results to Project objects (simplified mapping)
      const projects = result.rows.map((row: any) => ({
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
      }));

      return projects;
    } catch (error) {
      console.error('Failed to check overdue projects:', error);
      return [];
    }
  }

  /**
   * Check for projects that are overdue to end (in_progress projects past their end date)
   */
  private static async checkOverdueEndProjects(): Promise<Project[]> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      
      // Use direct database query for projects overdue to end
      const pool = require('../config/database').pool;
      const query = `
        SELECT 
          id, name, applicant_id, contractor_organization, contractor_contact,
          state, start_date, end_date, ST_AsGeoJSON(geometry)::json as geometry,
          work_type, work_category, description, has_conflict, 
          conflicting_project_ids, affected_municipalities, created_at, updated_at
        FROM projects 
        WHERE state = 'in_progress' AND end_date < $1
        ORDER BY end_date ASC
        LIMIT 50
      `;
      
      const result = await pool.query(query, [yesterday.toISOString().split('T')[0]]);
      
      // Map results to Project objects (simplified mapping)
      const projects = result.rows.map((row: any) => ({
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
      }));

      return projects;
    } catch (error) {
      console.error('Failed to check overdue end projects:', error);
      return [];
    }
  }

  /**
   * Send notification for overdue projects
   */
  static async notifyProjectOverdue(project: Project): Promise<void> {
    try {
      const applicant = await UserModel.findById(project.applicantId);
      if (!applicant) {
        console.error('Applicant not found for project:', project.id);
        return;
      }

      const daysOverdue = Math.ceil((Date.now() - project.startDate.getTime()) / (1000 * 60 * 60 * 24));

      const notificationData: NotificationData = {
        user: applicant,
        project,
        additionalData: { daysOverdue },
      };

      await emailService.queueEmail(
        applicant.email,
        'deadline_approaching', // Reuse template with overdue context
        notificationData
      );

      // Also notify coordinators
      const coordinators = await this.getMunicipalCoordinators(project.affectedMunicipalities);
      
      for (const coordinator of coordinators) {
        const coordinatorNotificationData: NotificationData = {
          user: coordinator,
          project,
          additionalData: { daysOverdue },
        };

        await emailService.queueEmail(
          coordinator.email,
          'deadline_approaching',
          coordinatorNotificationData
        );
      }

      console.log(`✅ Overdue project notifications sent for: ${project.name} (${daysOverdue} days overdue)`);
    } catch (error) {
      console.error('Failed to send overdue project notifications:', error);
    }
  }

  /**
   * Send notification when a project is ending soon
   */
  static async notifyProjectEndingSoon(project: Project, daysUntilEnd: number): Promise<void> {
    try {
      const applicant = await UserModel.findById(project.applicantId);
      if (!applicant) {
        console.error('Applicant not found for project:', project.id);
        return;
      }

      const notificationData: NotificationData = {
        user: applicant,
        project,
        additionalData: { daysUntilEnd, isEndingNotification: true },
      };

      await emailService.queueEmail(
        applicant.email,
        'deadline_approaching',
        notificationData
      );

      // Also notify coordinators
      const coordinators = await this.getMunicipalCoordinators(project.affectedMunicipalities);
      
      for (const coordinator of coordinators) {
        const coordinatorNotificationData: NotificationData = {
          user: coordinator,
          project,
          additionalData: { daysUntilEnd, isEndingNotification: true },
        };

        await emailService.queueEmail(
          coordinator.email,
          'deadline_approaching',
          coordinatorNotificationData
        );
      }

      console.log(`✅ Project ending soon notifications sent for: ${project.name} (${daysUntilEnd} days until end)`);
    } catch (error) {
      console.error('Failed to send project ending soon notifications:', error);
    }
  }

  /**
   * Send notification for projects that are overdue to end
   */
  static async notifyProjectOverdueEnd(project: Project): Promise<void> {
    try {
      const applicant = await UserModel.findById(project.applicantId);
      if (!applicant) {
        console.error('Applicant not found for project:', project.id);
        return;
      }

      const daysOverdueEnd = Math.ceil((Date.now() - project.endDate.getTime()) / (1000 * 60 * 60 * 24));

      const notificationData: NotificationData = {
        user: applicant,
        project,
        additionalData: { daysOverdueEnd, isOverdueEnd: true },
      };

      await emailService.queueEmail(
        applicant.email,
        'deadline_approaching',
        notificationData
      );

      // Also notify coordinators
      const coordinators = await this.getMunicipalCoordinators(project.affectedMunicipalities);
      
      for (const coordinator of coordinators) {
        const coordinatorNotificationData: NotificationData = {
          user: coordinator,
          project,
          additionalData: { daysOverdueEnd, isOverdueEnd: true },
        };

        await emailService.queueEmail(
          coordinator.email,
          'deadline_approaching',
          coordinatorNotificationData
        );
      }

      console.log(`✅ Overdue end project notifications sent for: ${project.name} (${daysOverdueEnd} days past end date)`);
    } catch (error) {
      console.error('Failed to send overdue end project notifications:', error);
    }
  }

  /**
   * Get municipal coordinators for given municipality codes
   */
  private static async getMunicipalCoordinators(municipalityCodes: string[]): Promise<User[]> {
    if (municipalityCodes.length === 0) {
      return [];
    }

    try {
      const { users: allCoordinators } = await UserModel.findAll({ 
        role: 'municipal_coordinator', 
        isActive: true,
        limit: 1000 // Get all coordinators
      });

      const coordinators: User[] = [];

      for (const coordinator of allCoordinators) {
        const territories = await UserModel.getUserTerritories(coordinator.id);
        const hasAccess = territories.some(territory => 
          municipalityCodes.includes(territory.municipalityCode)
        );

        if (hasAccess) {
          coordinators.push(coordinator);
        }
      }

      return coordinators;
    } catch (error) {
      console.error('Failed to get municipal coordinators:', error);
      return [];
    }
  }

  /**
   * Get all users (applicants and coordinators) in a specific municipality
   */
  private static async getUsersInMunicipality(municipalityCode: string): Promise<User[]> {
    try {
      const users: User[] = [];

      // Get municipal coordinators for this municipality
      const coordinators = await this.getMunicipalCoordinators([municipalityCode]);
      users.push(...coordinators);

      // Get all active applicants (they might be interested in moratoriums)
      const { users: applicants } = await UserModel.findAll({ 
        role: 'applicant', 
        isActive: true,
        limit: 1000
      });
      users.push(...applicants);

      // Remove duplicates based on user ID
      const uniqueUsers = users.filter((user, index, self) => 
        index === self.findIndex(u => u.id === user.id)
      );

      return uniqueUsers;
    } catch (error) {
      console.error('Failed to get users in municipality:', error);
      return [];
    }
  }



  /**
   * Send immediate notification (bypass queue)
   */
  static async sendImmediateNotification(
    email: string,
    type: NotificationType,
    data: NotificationData
  ): Promise<boolean> {
    try {
      return await emailService.sendEmailNow(email, type, data);
    } catch (error) {
      console.error('Failed to send immediate notification:', error);
      return false;
    }
  }

  /**
   * Get notification queue status
   */
  static getQueueStatus(): { pending: number; failed: number } {
    return emailService.getQueueStatus();
  }
}

// Export singleton instance
export const notificationService = NotificationService;