import * as cron from 'node-cron';
import { NotificationService } from './NotificationService';

/**
 * Deadline scheduler service for automated deadline notifications
 * Runs daily checks for approaching project deadlines
 */
export class DeadlineScheduler {
  private static instance: DeadlineScheduler;
  private scheduledTask: cron.ScheduledTask | null = null;
  private isRunning = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): DeadlineScheduler {
    if (!DeadlineScheduler.instance) {
      DeadlineScheduler.instance = new DeadlineScheduler();
    }
    return DeadlineScheduler.instance;
  }

  /**
   * Start the deadline scheduler
   * Runs every day at 9:00 AM
   */
  start(): void {
    if (this.scheduledTask) {
      console.log('⚠️ Deadline scheduler is already running');
      return;
    }

    // Schedule to run every day at 9:00 AM
    this.scheduledTask = cron.schedule('0 9 * * *', async () => {
      await this.runDeadlineCheck();
    }, {
      timezone: 'Europe/Prague'
    });

    this.isRunning = true;
    console.log('📅 Deadline scheduler started - will run daily at 9:00 AM (Prague time)');

    // Run initial check if it's past 9 AM today
    const now = new Date();
    const today9AM = new Date();
    today9AM.setHours(9, 0, 0, 0);

    if (now >= today9AM) {
      console.log('🔄 Running initial deadline check...');
      setTimeout(() => this.runDeadlineCheck(), 5000); // Run after 5 seconds
    }
  }

  /**
   * Stop the deadline scheduler
   */
  stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask.destroy();
      this.scheduledTask = null;
      this.isRunning = false;
      console.log('📅 Deadline scheduler stopped');
    }
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    nextRun?: Date;
    lastRun?: Date;
  } {
    const status: any = {
      isRunning: this.isRunning
    };

    if (this.scheduledTask) {
      // Calculate next run time (next day at 9:00 AM)
      const nextRun = new Date();
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(9, 0, 0, 0);
      status.nextRun = nextRun;
    }

    return status;
  }

  /**
   * Manually trigger deadline check (useful for testing)
   */
  async triggerManualCheck(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      console.log('🔄 Manual deadline check triggered');
      await this.runDeadlineCheck();
      
      return {
        success: true,
        message: 'Manual deadline check completed successfully'
      };
    } catch (error) {
      console.error('Manual deadline check failed:', error);
      
      return {
        success: false,
        message: 'Manual deadline check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Run the deadline check process
   */
  private async runDeadlineCheck(): Promise<void> {
    try {
      console.log('📅 Starting scheduled deadline check...');
      const startTime = Date.now();

      // Import NotificationTriggers to avoid circular dependency
      const { NotificationTriggers } = await import('./NotificationTriggers');
      await NotificationTriggers.onDeadlineApproaching();

      const duration = Date.now() - startTime;
      console.log(`✅ Deadline check completed in ${duration}ms`);
    } catch (error) {
      console.error('❌ Scheduled deadline check failed:', error);
    }
  }

  /**
   * Schedule a one-time deadline check at a specific time
   */
  scheduleOneTimeCheck(date: Date): boolean {
    try {
      const now = new Date();
      if (date <= now) {
        console.error('Cannot schedule deadline check in the past');
        return false;
      }

      const delay = date.getTime() - now.getTime();
      
      setTimeout(async () => {
        console.log(`🔄 Running scheduled one-time deadline check for ${date.toISOString()}`);
        await this.runDeadlineCheck();
      }, delay);

      console.log(`📅 One-time deadline check scheduled for ${date.toISOString()}`);
      return true;
    } catch (error) {
      console.error('Failed to schedule one-time deadline check:', error);
      return false;
    }
  }

  /**
   * Get deadline check statistics
   */
  async getDeadlineStatistics(): Promise<{
    projectsStartingIn3Days: number;
    projectsStartingIn7Days: number;
    totalNotificationsSent: number;
  }> {
    try {
      // This would typically query the database for statistics
      // For now, return placeholder data
      return {
        projectsStartingIn3Days: 0,
        projectsStartingIn7Days: 0,
        totalNotificationsSent: 0
      };
    } catch (error) {
      console.error('Failed to get deadline statistics:', error);
      return {
        projectsStartingIn3Days: 0,
        projectsStartingIn7Days: 0,
        totalNotificationsSent: 0
      };
    }
  }
}

// Export singleton instance
export const deadlineScheduler = DeadlineScheduler.getInstance();