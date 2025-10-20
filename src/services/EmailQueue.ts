import { NotificationType, NotificationData } from './EmailService';

export interface QueuedEmail {
  id: string;
  to: string;
  type: NotificationType;
  data: NotificationData;
  subject: string;
  html: string;
  text: string;
  retryCount: number;
  maxRetries: number;
  scheduledAt: Date;
  createdAt: Date;
  lastAttempt?: Date;
  errorMessage?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface QueueStats {
  pending: number;
  failed: number;
  total: number;
  processing: boolean;
  oldestPending?: Date;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
}

/**
 * Email queue management system
 * This is an in-memory implementation that can be extended to use Redis or database
 */
export class EmailQueue {
  private queue: QueuedEmail[] = [];
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly PROCESSING_INTERVAL = 30000; // 30 seconds
  private readonly DEFAULT_MAX_RETRIES = 3;

  constructor() {
    this.startProcessor();
  }

  /**
   * Add email to queue
   */
  enqueue(email: Omit<QueuedEmail, 'id' | 'createdAt' | 'retryCount' | 'maxRetries' | 'priority'> & {
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    maxRetries?: number;
  }): string {
    const queuedEmail: QueuedEmail = {
      id: this.generateId(),
      retryCount: 0,
      maxRetries: email.maxRetries || this.DEFAULT_MAX_RETRIES,
      priority: email.priority || 'normal',
      createdAt: new Date(),
      ...email
    };

    // Insert based on priority
    this.insertByPriority(queuedEmail);
    
    console.log(`📧 Email queued [${queuedEmail.priority}]: ${queuedEmail.type} to ${queuedEmail.to}`);
    return queuedEmail.id;
  }

  /**
   * Insert email into queue based on priority
   */
  private insertByPriority(email: QueuedEmail): void {
    const priorityOrder = { 'urgent': 0, 'high': 1, 'normal': 2, 'low': 3 };
    const emailPriority = priorityOrder[email.priority];

    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const queueItem = this.queue[i];
      if (queueItem) {
        const queuePriority = priorityOrder[queueItem.priority];
        if (emailPriority < queuePriority) {
          insertIndex = i;
          break;
        }
      }
    }

    this.queue.splice(insertIndex, 0, email);
  }

  /**
   * Get next emails to process
   */
  getNextBatch(batchSize: number = 10): QueuedEmail[] {
    const now = new Date();
    return this.queue
      .filter(email => 
        email.scheduledAt <= now && 
        email.retryCount < email.maxRetries
      )
      .slice(0, batchSize);
  }

  /**
   * Mark email as sent successfully
   */
  markSent(emailId: string): void {
    this.queue = this.queue.filter(email => email.id !== emailId);
  }

  /**
   * Mark email as failed and schedule retry
   */
  markFailed(emailId: string, error: string): void {
    const email = this.queue.find(e => e.id === emailId);
    if (!email) return;

    email.retryCount++;
    email.lastAttempt = new Date();
    email.errorMessage = error;

    if (email.retryCount >= email.maxRetries) {
      // Move to failed (keep in queue for monitoring but won't be processed)
      console.error(`❌ Email permanently failed: ${email.subject} to ${email.to}`);
    } else {
      // Schedule retry with exponential backoff
      const backoffMinutes = Math.pow(2, email.retryCount) * 5; // 10, 20, 40 minutes
      email.scheduledAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
      console.log(`📅 Email retry scheduled in ${backoffMinutes} minutes: ${email.subject}`);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const pending = this.queue.filter(e => e.retryCount < e.maxRetries);
    const failed = this.queue.filter(e => e.retryCount >= e.maxRetries);
    
    const byPriority: Record<string, number> = {
      urgent: 0, high: 0, normal: 0, low: 0
    };
    const byType: Record<string, number> = {};

    pending.forEach(email => {
      const priority = email.priority;
      if (priority && byPriority[priority] !== undefined) {
        byPriority[priority]++;
      }
      byType[email.type] = (byType[email.type] || 0) + 1;
    });

    const oldestPending = pending.length > 0 
      ? new Date(Math.min(...pending.map(e => e.createdAt.getTime())))
      : undefined;

    return {
      pending: pending.length,
      failed: failed.length,
      total: this.queue.length,
      processing: this.isProcessing,
      oldestPending,
      byPriority,
      byType
    };
  }

  /**
   * Get detailed queue information
   */
  getDetails(): {
    pending: Array<{
      id: string;
      to: string;
      type: NotificationType;
      subject: string;
      priority: string;
      retryCount: number;
      maxRetries: number;
      scheduledAt: Date;
      createdAt: Date;
      lastAttempt?: Date;
      errorMessage?: string;
    }>;
    failed: Array<{
      id: string;
      to: string;
      type: NotificationType;
      subject: string;
      retryCount: number;
      errorMessage?: string;
      createdAt: Date;
      lastAttempt?: Date;
    }>;
  } {
    const pending = this.queue.filter(e => e.retryCount < e.maxRetries);
    const failed = this.queue.filter(e => e.retryCount >= e.maxRetries);

    return {
      pending: pending.map(email => ({
        id: email.id,
        to: email.to,
        type: email.type,
        subject: email.subject,
        priority: email.priority,
        retryCount: email.retryCount,
        maxRetries: email.maxRetries,
        scheduledAt: email.scheduledAt,
        createdAt: email.createdAt,
        lastAttempt: email.lastAttempt,
        errorMessage: email.errorMessage
      })),
      failed: failed.map(email => ({
        id: email.id,
        to: email.to,
        type: email.type,
        subject: email.subject,
        retryCount: email.retryCount,
        errorMessage: email.errorMessage,
        createdAt: email.createdAt,
        lastAttempt: email.lastAttempt
      }))
    };
  }

  /**
   * Clear failed emails
   */
  clearFailed(): number {
    const failedCount = this.queue.filter(e => e.retryCount >= e.maxRetries).length;
    this.queue = this.queue.filter(e => e.retryCount < e.maxRetries);
    console.log(`🧹 Cleared ${failedCount} failed emails from queue`);
    return failedCount;
  }

  /**
   * Remove specific email from queue
   */
  remove(emailId: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(e => e.id !== emailId);
    return this.queue.length < initialLength;
  }

  /**
   * Retry specific failed email immediately
   */
  retryEmail(emailId: string): boolean {
    const email = this.queue.find(e => e.id === emailId);
    if (!email || email.retryCount < email.maxRetries) {
      return false;
    }

    // Reset retry count and schedule immediately
    email.retryCount = 0;
    email.scheduledAt = new Date();
    email.errorMessage = undefined;
    email.lastAttempt = undefined;

    console.log(`🔄 Email retry requested: ${email.subject} to ${email.to}`);
    return true;
  }

  /**
   * Start queue processor
   */
  private startProcessor(): void {
    this.processingInterval = setInterval(() => {
      // This will be called by EmailService with a processor function
    }, this.PROCESSING_INTERVAL);

    console.log('📧 Email queue processor started');
  }

  /**
   * Process queue (to be called by EmailService)
   */
  async processQueue(processor: (emails: QueuedEmail[]) => Promise<void>): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    try {
      const emailsToProcess = this.getNextBatch();
      if (emailsToProcess.length > 0) {
        await processor(emailsToProcess);
      }
    } catch (error) {
      console.error('Error processing email queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Stop queue processor
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('📧 Email queue processor stopped');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Purge all emails (use with caution)
   */
  purge(): number {
    const count = this.queue.length;
    this.queue = [];
    console.log(`🗑️ Purged ${count} emails from queue`);
    return count;
  }
}