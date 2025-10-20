import { Router, Request, Response } from 'express';
import { emailService } from '../services/EmailService';
import { notificationService } from '../services/NotificationService';
import { notificationTriggers } from '../services/NotificationTriggers';
import { deadlineScheduler } from '../services/DeadlineScheduler';
import { authenticateToken } from '../middleware/auth';
import { requireRegionalAdmin } from '../middleware/rbac';

const router = Router();

// Apply authentication and admin-only access to all routes
router.use(authenticateToken);
router.use(requireRegionalAdmin);

/**
 * GET /api/admin/email/status
 * Get email system status and queue information
 */
router.get('/email/status', async (req: Request, res: Response) => {
  try {
    const queueStats = emailService.getQueueStatus();
    const queueDetails = emailService.getQueueDetails();

    res.json({
      success: true,
      data: {
        stats: queueStats,
        details: queueDetails,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to get email status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get email status'
    });
  }
});

/**
 * POST /api/admin/email/test
 * Test email configuration by sending a test email
 */
router.post('/email/test', async (req: Request, res: Response) => {
  try {
    const testResult = await emailService.testConfiguration();

    res.json({
      success: testResult.success,
      data: testResult
    });
  } catch (error) {
    console.error('Failed to test email configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test email configuration'
    });
  }
});

/**
 * POST /api/admin/email/verify
 * Verify SMTP connection
 */
router.post('/email/verify', async (req: Request, res: Response) => {
  try {
    const isConnected = await emailService.verifyConnection();

    res.json({
      success: true,
      data: {
        connected: isConnected,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to verify email connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify email connection'
    });
  }
});

/**
 * DELETE /api/admin/email/failed
 * Clear failed emails from queue
 */
router.delete('/email/failed', async (req: Request, res: Response) => {
  try {
    const clearedCount = emailService.clearFailedEmails();

    res.json({
      success: true,
      data: {
        clearedCount,
        message: `Cleared ${clearedCount} failed emails from queue`
      }
    });
  } catch (error) {
    console.error('Failed to clear failed emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear failed emails'
    });
  }
});

/**
 * POST /api/admin/email/retry/:emailId
 * Retry specific failed email
 */
router.post('/email/retry/:emailId', async (req: Request, res: Response) => {
  try {
    const { emailId } = req.params;
    
    if (!emailId) {
      res.status(400).json({
        success: false,
        error: 'Email ID is required'
      });
      return;
    }

    const success = emailService.retryEmail(emailId);

    if (success) {
      res.json({
        success: true,
        data: {
          message: 'Email retry scheduled'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Email not found or not eligible for retry'
      });
    }
  } catch (error) {
    console.error('Failed to retry email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry email'
    });
  }
});

/**
 * DELETE /api/admin/email/:emailId
 * Remove specific email from queue
 */
router.delete('/email/:emailId', async (req: Request, res: Response) => {
  try {
    const { emailId } = req.params;
    
    if (!emailId) {
      res.status(400).json({
        success: false,
        error: 'Email ID is required'
      });
      return;
    }

    const success = emailService.removeEmail(emailId);

    if (success) {
      res.json({
        success: true,
        data: {
          message: 'Email removed from queue'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Email not found in queue'
      });
    }
  } catch (error) {
    console.error('Failed to remove email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove email'
    });
  }
});

/**
 * POST /api/admin/notifications/deadline-check
 * Manually trigger deadline check
 */
router.post('/notifications/deadline-check', async (req: Request, res: Response) => {
  try {
    const result = await deadlineScheduler.triggerManualCheck();

    res.json({
      success: result.success,
      data: {
        message: result.message,
        details: result.details
      }
    });
  } catch (error) {
    console.error('Failed to trigger deadline check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger deadline check'
    });
  }
});

/**
 * GET /api/admin/notifications/status
 * Get comprehensive notification system status
 */
router.get('/notifications/status', async (req: Request, res: Response) => {
  try {
    const systemStatus = notificationTriggers.getSystemStatus();
    const deadlineStats = await deadlineScheduler.getDeadlineStatistics();

    res.json({
      success: true,
      data: {
        ...systemStatus,
        deadlineStatistics: deadlineStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to get notification status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification status'
    });
  }
});

/**
 * POST /api/admin/notifications/scheduler/start
 * Start the deadline scheduler
 */
router.post('/notifications/scheduler/start', async (req: Request, res: Response) => {
  try {
    deadlineScheduler.start();

    res.json({
      success: true,
      data: {
        message: 'Deadline scheduler started successfully'
      }
    });
  } catch (error) {
    console.error('Failed to start deadline scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start deadline scheduler'
    });
  }
});

/**
 * POST /api/admin/notifications/scheduler/stop
 * Stop the deadline scheduler
 */
router.post('/notifications/scheduler/stop', async (req: Request, res: Response) => {
  try {
    deadlineScheduler.stop();

    res.json({
      success: true,
      data: {
        message: 'Deadline scheduler stopped successfully'
      }
    });
  } catch (error) {
    console.error('Failed to stop deadline scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop deadline scheduler'
    });
  }
});

/**
 * GET /api/admin/notifications/scheduler/status
 * Get deadline scheduler status
 */
router.get('/notifications/scheduler/status', async (req: Request, res: Response) => {
  try {
    const status = deadlineScheduler.getStatus();
    const statistics = await deadlineScheduler.getDeadlineStatistics();

    res.json({
      success: true,
      data: {
        ...status,
        statistics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to get scheduler status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduler status'
    });
  }
});

/**
 * POST /api/admin/notifications/scheduler/schedule
 * Schedule a one-time deadline check
 */
router.post('/notifications/scheduler/schedule', async (req: Request, res: Response) => {
  try {
    const { date } = req.body;

    if (!date) {
      res.status(400).json({
        success: false,
        error: 'Date is required'
      });
      return;
    }

    const scheduleDate = new Date(date);
    if (isNaN(scheduleDate.getTime())) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
      return;
    }

    const success = deadlineScheduler.scheduleOneTimeCheck(scheduleDate);

    if (success) {
      res.json({
        success: true,
        data: {
          message: `One-time deadline check scheduled for ${scheduleDate.toISOString()}`
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to schedule deadline check (date may be in the past)'
      });
    }
  } catch (error) {
    console.error('Failed to schedule deadline check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule deadline check'
    });
  }
});

export default router;