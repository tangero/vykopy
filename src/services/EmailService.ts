import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';
import { User, Project, ProjectComment, Moratorium } from '../types';
import { EmailTemplates } from './EmailTemplates';
import { EmailQueue, QueuedEmail } from './EmailQueue';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface NotificationData {
  user: User;
  project?: Project;
  comment?: ProjectComment;
  moratorium?: Moratorium;
  conflicts?: Project[];
  actionUrl?: string;
  additionalData?: Record<string, any>;
}

export type NotificationType = 
  | 'project_submitted'
  | 'project_approved' 
  | 'project_rejected'
  | 'project_state_changed'
  | 'conflict_detected'
  | 'comment_added'
  | 'deadline_approaching'
  | 'moratorium_created'
  | 'user_registered';

// QueuedEmail interface moved to EmailQueue.ts

export class EmailService {
  private transporter!: Transporter;
  private queue: EmailQueue;

  constructor() {
    this.initializeTransporter();
    this.queue = new EmailQueue();
    this.startQueueProcessor();
  }

  private initializeTransporter(): void {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465, // true for 465, false for other ports
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }

  // Verify SMTP connection
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified');
      return true;
    } catch (error) {
      console.error('❌ SMTP connection failed:', error);
      return false;
    }
  }

  // Generate email template based on notification type
  private generateTemplate(type: NotificationType, data: NotificationData): EmailTemplate {
    const { user, project, comment, moratorium, conflicts, actionUrl } = data;
    const baseUrl = config.frontendUrl;

    switch (type) {
      case 'project_submitted':
        return {
          subject: `[DigiKop] Nový projekt k schválení: ${project?.name}`,
          html: this.getProjectSubmittedHtml(user, project!, actionUrl || `${baseUrl}/projects/${project?.id}`),
          text: this.getProjectSubmittedText(user, project!, actionUrl || `${baseUrl}/projects/${project?.id}`),
        };

      case 'project_approved':
        return {
          subject: `[DigiKop] Projekt schválen: ${project?.name}`,
          html: this.getProjectApprovedHtml(user, project!, actionUrl || `${baseUrl}/projects/${project?.id}`),
          text: this.getProjectApprovedText(user, project!, actionUrl || `${baseUrl}/projects/${project?.id}`),
        };

      case 'project_rejected':
        return {
          subject: `[DigiKop] Projekt zamítnut: ${project?.name}`,
          html: this.getProjectRejectedHtml(user, project!, actionUrl || `${baseUrl}/projects/${project?.id}`),
          text: this.getProjectRejectedText(user, project!, actionUrl || `${baseUrl}/projects/${project?.id}`),
        };

      case 'project_state_changed':
        return {
          subject: `[DigiKop] Změna stavu projektu: ${project?.name}`,
          html: this.getProjectStateChangedHtml(user, project!, actionUrl || `${baseUrl}/projects/${project?.id}`),
          text: this.getProjectStateChangedText(user, project!, actionUrl || `${baseUrl}/projects/${project?.id}`),
        };

      case 'conflict_detected':
        return {
          subject: `[DigiKop] Detekován konflikt: ${project?.name}`,
          html: this.getConflictDetectedHtml(user, project!, conflicts || [], actionUrl || `${baseUrl}/projects/${project?.id}`),
          text: this.getConflictDetectedText(user, project!, conflicts || [], actionUrl || `${baseUrl}/projects/${project?.id}`),
        };

      case 'comment_added':
        return {
          subject: `[DigiKop] Nový komentář k projektu: ${project?.name}`,
          html: this.getCommentAddedHtml(user, project!, comment!, actionUrl || `${baseUrl}/projects/${project?.id}`),
          text: this.getCommentAddedText(user, project!, comment!, actionUrl || `${baseUrl}/projects/${project?.id}`),
        };

      case 'deadline_approaching':
        return {
          subject: `[DigiKop] Blíží se termín: ${project?.name}`,
          html: this.getDeadlineApproachingHtml(user, project!, actionUrl || `${baseUrl}/projects/${project?.id}`, data),
          text: this.getDeadlineApproachingText(user, project!, actionUrl || `${baseUrl}/projects/${project?.id}`, data),
        };

      case 'moratorium_created':
        return {
          subject: `[DigiKop] Nové moratorium: ${moratorium?.name}`,
          html: this.getMoratoriumCreatedHtml(user, moratorium!, actionUrl || `${baseUrl}/moratoriums/${moratorium?.id}`),
          text: this.getMoratoriumCreatedText(user, moratorium!, actionUrl || `${baseUrl}/moratoriums/${moratorium?.id}`),
        };

      case 'user_registered':
        return {
          subject: `[DigiKop] Nová registrace uživatele`,
          html: this.getUserRegisteredHtml(user, actionUrl || `${baseUrl}/admin/users`),
          text: this.getUserRegisteredText(user, actionUrl || `${baseUrl}/admin/users`),
        };

      default:
        throw new Error(`Unknown notification type: ${type}`);
    }
  }

  // Queue email for sending
  async queueEmail(
    to: string,
    type: NotificationType,
    data: NotificationData,
    options?: {
      scheduledAt?: Date;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      maxRetries?: number;
    }
  ): Promise<string> {
    const template = this.generateTemplate(type, data);
    
    return this.queue.enqueue({
      to,
      type,
      data,
      subject: template.subject,
      html: template.html,
      text: template.text,
      scheduledAt: options?.scheduledAt || new Date(),
      priority: options?.priority,
      maxRetries: options?.maxRetries
    });
  }

  // Send email immediately (bypass queue)
  async sendEmailNow(
    to: string,
    type: NotificationType,
    data: NotificationData
  ): Promise<boolean> {
    try {
      const template = this.generateTemplate(type, data);
      
      await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      console.log(`✅ Email sent: ${type} to ${to}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send email: ${type} to ${to}`, error);
      return false;
    }
  }

  // Process email queue
  private async startQueueProcessor(): Promise<void> {
    // Process queue every 30 seconds
    setInterval(async () => {
      await this.queue.processQueue(async (emails: QueuedEmail[]) => {
        for (const email of emails) {
          try {
            await this.transporter.sendMail({
              from: config.email.from,
              to: email.to,
              subject: email.subject,
              html: email.html,
              text: email.text,
            });

            this.queue.markSent(email.id);
            console.log(`✅ Email sent [${email.priority}]: ${email.subject} to ${email.to}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.queue.markFailed(email.id, errorMessage);
            console.error(`❌ Failed to send email (attempt ${email.retryCount + 1}):`, error);
          }
        }
      });
    }, 30000);
  }

  // Get queue status
  getQueueStatus() {
    return this.queue.getStats();
  }

  // Clear failed emails from queue
  clearFailedEmails(): number {
    return this.queue.clearFailed();
  }

  // Get detailed queue information (for admin monitoring)
  getQueueDetails() {
    return this.queue.getDetails();
  }

  // Retry specific email
  retryEmail(emailId: string): boolean {
    return this.queue.retryEmail(emailId);
  }

  // Remove specific email from queue
  removeEmail(emailId: string): boolean {
    return this.queue.remove(emailId);
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('📧 Shutting down email service...');
    
    this.queue.stop();

    if (this.queue.size() > 0) {
      console.log(`⚠️ Email service shutdown with ${this.queue.size()} emails still in queue`);
    } else {
      console.log('✅ Email service shutdown complete');
    }
  }

  // Test email configuration
  async testConfiguration(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      // Test SMTP connection
      const isConnected = await this.verifyConnection();
      if (!isConnected) {
        return {
          success: false,
          message: 'SMTP connection failed'
        };
      }

      // Send test email to configured sender
      const testResult = await this.sendEmailNow(
        config.email.from,
        'user_registered',
        {
          user: {
            id: 'test-id',
            email: config.email.from,
            name: 'Test User',
            organization: 'Test Organization',
            role: 'applicant',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      return {
        success: testResult,
        message: testResult ? 'Email configuration test successful' : 'Test email failed to send',
        details: {
          host: config.email.host,
          port: config.email.port,
          from: config.email.from,
          queueStatus: this.getQueueStatus()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Email configuration test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // HTML Templates
  private getProjectSubmittedHtml(user: User, project: Project, actionUrl: string): string {
    const content = `
      <div class="header" style="background: #2563eb;">
        <h1>📋 Nový projekt k schválení</h1>
      </div>
      <div class="content">
        <p>Dobrý den ${user.name},</p>
        <p>byl podán nový projekt k schválení ve vašem území:</p>
        
        ${EmailTemplates.formatProjectInfo(project)}
        
        <p>Pro schválení nebo zamítnutí projektu klikněte na tlačítko níže:</p>
        ${EmailTemplates.createActionButton(actionUrl, 'Zobrazit projekt')}
      </div>
    `;
    
    return EmailTemplates.getBaseTemplate('Nový projekt k schválení', '#2563eb', content);
  }

  private getProjectSubmittedText(user: User, project: Project, actionUrl: string): string {
    return `
DigiKop - Nový projekt k schválení

Dobrý den ${user.name},

byl podán nový projekt k schválení ve vašem území:

Název: ${project.name}
Žadatel: ${project.contractorOrganization || 'Neuvedeno'}
Termín realizace: ${EmailTemplates.formatDate(project.startDate)} - ${EmailTemplates.formatDate(project.endDate)}
Kategorie: ${project.workCategory}
Typ práce: ${project.workType}
${project.description ? `Popis: ${project.description}` : ''}

Pro schválení nebo zamítnutí projektu navštivte: ${actionUrl}

---
Toto je automaticky generovaný email ze systému DigiKop.
    `;
  }

  private getProjectApprovedHtml(user: User, project: Project, actionUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Projekt schválen</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #16a34a; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .project-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Projekt schválen</h1>
          </div>
          <div class="content">
            <p>Dobrý den ${user.name},</p>
            <p>váš projekt byl úspěšně schválen:</p>
            
            <div class="project-info">
              <h3>${project.name}</h3>
              <p><strong>Termín realizace:</strong> ${this.formatDate(project.startDate)} - ${this.formatDate(project.endDate)}</p>
              <p><strong>Stav:</strong> Schválen</p>
            </div>
            
            <p>Můžete nyní zahájit realizaci projektu v plánovaném termínu.</p>
            <a href="${actionUrl}" class="button">Zobrazit projekt</a>
          </div>
          <div class="footer">
            <p>Toto je automaticky generovaný email ze systému DigiKop.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getProjectApprovedText(user: User, project: Project, actionUrl: string): string {
    return `
DigiKop - Projekt schválen

Dobrý den ${user.name},

váš projekt byl úspěšně schválen:

Název: ${project.name}
Termín realizace: ${this.formatDate(project.startDate)} - ${this.formatDate(project.endDate)}
Stav: Schválen

Můžete nyní zahájit realizaci projektu v plánovaném termínu.

Zobrazit projekt: ${actionUrl}

---
Toto je automaticky generovaný email ze systému DigiKop.
    `;
  }

  private getProjectRejectedHtml(user: User, project: Project, actionUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Projekt zamítnut</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .project-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Projekt zamítnut</h1>
          </div>
          <div class="content">
            <p>Dobrý den ${user.name},</p>
            <p>váš projekt byl zamítnut:</p>
            
            <div class="project-info">
              <h3>${project.name}</h3>
              <p><strong>Termín realizace:</strong> ${this.formatDate(project.startDate)} - ${this.formatDate(project.endDate)}</p>
              <p><strong>Stav:</strong> Zamítnut</p>
            </div>
            
            <p>Pro více informací o důvodu zamítnutí si prosím prohlédněte komentáře k projektu.</p>
            <a href="${actionUrl}" class="button">Zobrazit projekt</a>
          </div>
          <div class="footer">
            <p>Toto je automaticky generovaný email ze systému DigiKop.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getProjectRejectedText(user: User, project: Project, actionUrl: string): string {
    return `
DigiKop - Projekt zamítnut

Dobrý den ${user.name},

váš projekt byl zamítnut:

Název: ${project.name}
Termín realizace: ${this.formatDate(project.startDate)} - ${this.formatDate(project.endDate)}
Stav: Zamítnut

Pro více informací o důvodu zamítnutí si prosím prohlédněte komentáře k projektu.

Zobrazit projekt: ${actionUrl}

---
Toto je automaticky generovaný email ze systému DigiKop.
    `;
  }

  private getProjectStateChangedHtml(user: User, project: Project, actionUrl: string): string {
    const stateLabels: Record<string, string> = {
      'draft': 'Koncept',
      'forward_planning': 'Předběžné plánování',
      'pending_approval': 'Čeká na schválení',
      'approved': 'Schválen',
      'in_progress': 'Probíhá',
      'completed': 'Dokončen',
      'rejected': 'Zamítnut',
      'cancelled': 'Zrušen'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Změna stavu projektu</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .project-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Změna stavu projektu</h1>
          </div>
          <div class="content">
            <p>Dobrý den ${user.name},</p>
            <p>stav vašeho projektu se změnil:</p>
            
            <div class="project-info">
              <h3>${project.name}</h3>
              <p><strong>Nový stav:</strong> ${stateLabels[project.state] || project.state}</p>
              <p><strong>Termín realizace:</strong> ${this.formatDate(project.startDate)} - ${this.formatDate(project.endDate)}</p>
            </div>
            
            <a href="${actionUrl}" class="button">Zobrazit projekt</a>
          </div>
          <div class="footer">
            <p>Toto je automaticky generovaný email ze systému DigiKop.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getProjectStateChangedText(user: User, project: Project, actionUrl: string): string {
    const stateLabels: Record<string, string> = {
      'draft': 'Koncept',
      'forward_planning': 'Předběžné plánování',
      'pending_approval': 'Čeká na schválení',
      'approved': 'Schválen',
      'in_progress': 'Probíhá',
      'completed': 'Dokončen',
      'rejected': 'Zamítnut',
      'cancelled': 'Zrušen'
    };

    return `
DigiKop - Změna stavu projektu

Dobrý den ${user.name},

stav vašeho projektu se změnil:

Název: ${project.name}
Nový stav: ${stateLabels[project.state] || project.state}
Termín realizace: ${this.formatDate(project.startDate)} - ${this.formatDate(project.endDate)}

Zobrazit projekt: ${actionUrl}

---
Toto je automaticky generovaný email ze systému DigiKop.
    `;
  }

  private getConflictDetectedHtml(user: User, project: Project, conflicts: Project[], actionUrl: string): string {
    const conflictList = conflicts.map(c => `<li>${c.name} (${this.formatDate(c.startDate)} - ${this.formatDate(c.endDate)})</li>`).join('');
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Detekován konflikt</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .project-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Detekován konflikt</h1>
          </div>
          <div class="content">
            <p>Dobrý den ${user.name},</p>
            <p>byl detekován konflikt u projektu:</p>
            
            <div class="project-info">
              <h3>${project.name}</h3>
              <p><strong>Termín realizace:</strong> ${this.formatDate(project.startDate)} - ${this.formatDate(project.endDate)}</p>
            </div>
            
            <div class="warning">
              <h4>Konfliktní projekty:</h4>
              <ul>${conflictList}</ul>
            </div>
            
            <p>Prosím koordinujte termíny realizace s ostatními projekty.</p>
            <a href="${actionUrl}" class="button">Zobrazit projekt</a>
          </div>
          <div class="footer">
            <p>Toto je automaticky generovaný email ze systému DigiKop.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getConflictDetectedText(user: User, project: Project, conflicts: Project[], actionUrl: string): string {
    const conflictList = conflicts.map(c => `- ${c.name} (${this.formatDate(c.startDate)} - ${this.formatDate(c.endDate)})`).join('\n');
    
    return `
DigiKop - Detekován konflikt

Dobrý den ${user.name},

byl detekován konflikt u projektu:

Název: ${project.name}
Termín realizace: ${this.formatDate(project.startDate)} - ${this.formatDate(project.endDate)}

Konfliktní projekty:
${conflictList}

Prosím koordinujte termíny realizace s ostatními projekty.

Zobrazit projekt: ${actionUrl}

---
Toto je automaticky generovaný email ze systému DigiKop.
    `;
  }

  private getCommentAddedHtml(user: User, project: Project, comment: ProjectComment, actionUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Nový komentář</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .project-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .comment { background: #e5e7eb; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 Nový komentář</h1>
          </div>
          <div class="content">
            <p>Dobrý den ${user.name},</p>
            <p>byl přidán nový komentář k projektu:</p>
            
            <div class="project-info">
              <h3>${project.name}</h3>
            </div>
            
            <div class="comment">
              <p><strong>Komentář:</strong></p>
              <p>${comment.content}</p>
              <p><small>Přidáno: ${this.formatDateTime(comment.createdAt)}</small></p>
            </div>
            
            <a href="${actionUrl}" class="button">Zobrazit projekt</a>
          </div>
          <div class="footer">
            <p>Toto je automaticky generovaný email ze systému DigiKop.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getCommentAddedText(user: User, project: Project, comment: ProjectComment, actionUrl: string): string {
    return `
DigiKop - Nový komentář

Dobrý den ${user.name},

byl přidán nový komentář k projektu:

Projekt: ${project.name}

Komentář:
${comment.content}

Přidáno: ${this.formatDateTime(comment.createdAt)}

Zobrazit projekt: ${actionUrl}

---
Toto je automaticky generovaný email ze systému DigiKop.
    `;
  }

  private getDeadlineApproachingHtml(user: User, project: Project, actionUrl: string, data?: NotificationData): string {
    const { additionalData } = data || {};
    const daysUntilStart = additionalData?.daysUntilDeadline || Math.ceil((project.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const daysOverdue = additionalData?.daysOverdue;
    const daysUntilEnd = additionalData?.daysUntilEnd;
    const daysOverdueEnd = additionalData?.daysOverdueEnd;
    const isEndingNotification = additionalData?.isEndingNotification;
    const isOverdueEnd = additionalData?.isOverdueEnd;
    
    let title, message, timeInfo;
    
    if (daysOverdue) {
      title = "⚠️ Projekt je po termínu";
      message = "váš projekt měl být již zahájen:";
      timeInfo = `<p><strong>Po termínu:</strong> ${daysOverdue} ${daysOverdue === 1 ? 'den' : daysOverdue < 5 ? 'dny' : 'dní'}</p>`;
    } else if (isOverdueEnd && daysOverdueEnd) {
      title = "⚠️ Projekt překročil termín dokončení";
      message = "váš projekt měl být již dokončen:";
      timeInfo = `<p><strong>Po termínu dokončení:</strong> ${daysOverdueEnd} ${daysOverdueEnd === 1 ? 'den' : daysOverdueEnd < 5 ? 'dny' : 'dní'}</p>`;
    } else if (isEndingNotification && daysUntilEnd) {
      title = "⏰ Blíží se termín dokončení";
      message = "blíží se termín dokončení vašeho projektu:";
      timeInfo = `<p><strong>Dokončení za:</strong> ${daysUntilEnd} ${daysUntilEnd === 1 ? 'den' : daysUntilEnd < 5 ? 'dny' : 'dní'}</p>`;
    } else {
      title = "⏰ Blíží se termín zahájení";
      message = "blíží se termín zahájení vašeho projektu:";
      timeInfo = `<p><strong>Zahájení za:</strong> ${daysUntilStart} ${daysUntilStart === 1 ? 'den' : daysUntilStart < 5 ? 'dny' : 'dní'}</p>`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Blíží se termín</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .project-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .overdue { background: #dc2626; }
          .overdue .button { background: #dc2626; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header ${daysOverdue || isOverdueEnd ? 'overdue' : ''}">
            <h1>${title}</h1>
          </div>
          <div class="content">
            <p>Dobrý den ${user.name},</p>
            <p>${message}</p>
            
            <div class="project-info">
              <h3>${project.name}</h3>
              ${timeInfo}
              <p><strong>Termín realizace:</strong> ${this.formatDate(project.startDate)} - ${this.formatDate(project.endDate)}</p>
              <p><strong>Stav:</strong> ${project.state}</p>
            </div>
            
            ${daysOverdue ? '<p>Prosím aktualizujte stav projektu nebo kontaktujte koordinátora.</p>' : 
              isOverdueEnd ? '<p>Prosím označte projekt jako dokončený nebo prodlužte termín.</p>' :
              isEndingNotification ? '<p>Ujistěte se, že projekt bude dokončen včas.</p>' :
              '<p>Ujistěte se, že máte vše připraveno pro zahájení prací.</p>'}
            <a href="${actionUrl}" class="button">Zobrazit projekt</a>
          </div>
          <div class="footer">
            <p>Toto je automaticky generovaný email ze systému DigiKop.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getDeadlineApproachingText(user: User, project: Project, actionUrl: string, data?: NotificationData): string {
    const { additionalData } = data || {};
    const daysUntilStart = additionalData?.daysUntilDeadline || Math.ceil((project.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const daysOverdue = additionalData?.daysOverdue;
    const daysUntilEnd = additionalData?.daysUntilEnd;
    const daysOverdueEnd = additionalData?.daysOverdueEnd;
    const isEndingNotification = additionalData?.isEndingNotification;
    const isOverdueEnd = additionalData?.isOverdueEnd;
    
    let title, message, timeInfo, actionMessage;
    
    if (daysOverdue) {
      title = "DigiKop - Projekt je po termínu";
      message = "váš projekt měl být již zahájen:";
      timeInfo = `Po termínu: ${daysOverdue} ${daysOverdue === 1 ? 'den' : daysOverdue < 5 ? 'dny' : 'dní'}`;
      actionMessage = "Prosím aktualizujte stav projektu nebo kontaktujte koordinátora.";
    } else if (isOverdueEnd && daysOverdueEnd) {
      title = "DigiKop - Projekt překročil termín dokončení";
      message = "váš projekt měl být již dokončen:";
      timeInfo = `Po termínu dokončení: ${daysOverdueEnd} ${daysOverdueEnd === 1 ? 'den' : daysOverdueEnd < 5 ? 'dny' : 'dní'}`;
      actionMessage = "Prosím označte projekt jako dokončený nebo prodlužte termín.";
    } else if (isEndingNotification && daysUntilEnd) {
      title = "DigiKop - Blíží se termín dokončení";
      message = "blíží se termín dokončení vašeho projektu:";
      timeInfo = `Dokončení za: ${daysUntilEnd} ${daysUntilEnd === 1 ? 'den' : daysUntilEnd < 5 ? 'dny' : 'dní'}`;
      actionMessage = "Ujistěte se, že projekt bude dokončen včas.";
    } else {
      title = "DigiKop - Blíží se termín zahájení";
      message = "blíží se termín zahájení vašeho projektu:";
      timeInfo = `Zahájení za: ${daysUntilStart} ${daysUntilStart === 1 ? 'den' : daysUntilStart < 5 ? 'dny' : 'dní'}`;
      actionMessage = "Ujistěte se, že máte vše připraveno pro zahájení prací.";
    }
    
    return `
${title}

Dobrý den ${user.name},

${message}

Název: ${project.name}
${timeInfo}
Termín realizace: ${this.formatDate(project.startDate)} - ${this.formatDate(project.endDate)}
Stav: ${project.state}

${actionMessage}

Zobrazit projekt: ${actionUrl}

---
Toto je automaticky generovaný email ze systému DigiKop.
    `;
  }

  private getMoratoriumCreatedHtml(user: User, moratorium: Moratorium, actionUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Nové moratorium</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .moratorium-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚫 Nové moratorium</h1>
          </div>
          <div class="content">
            <p>Dobrý den ${user.name},</p>
            <p>bylo vytvořeno nové moratorium ve vašem území:</p>
            
            <div class="moratorium-info">
              <h3>${moratorium.name}</h3>
              <p><strong>Důvod:</strong> ${moratorium.reason}</p>
              ${moratorium.reasonDetail ? `<p><strong>Detail:</strong> ${moratorium.reasonDetail}</p>` : ''}
              <p><strong>Platnost:</strong> ${this.formatDate(moratorium.validFrom)} - ${this.formatDate(moratorium.validTo)}</p>
              <p><strong>Obec:</strong> ${moratorium.municipalityCode}</p>
              ${moratorium.exceptions ? `<p><strong>Výjimky:</strong> ${moratorium.exceptions}</p>` : ''}
            </div>
            
            <p>V této oblasti jsou dočasně omezeny výkopové práce.</p>
            <a href="${actionUrl}" class="button">Zobrazit moratorium</a>
          </div>
          <div class="footer">
            <p>Toto je automaticky generovaný email ze systému DigiKop.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getMoratoriumCreatedText(user: User, moratorium: Moratorium, actionUrl: string): string {
    return `
DigiKop - Nové moratorium

Dobrý den ${user.name},

bylo vytvořeno nové moratorium ve vašem území:

Název: ${moratorium.name}
Důvod: ${moratorium.reason}
${moratorium.reasonDetail ? `Detail: ${moratorium.reasonDetail}` : ''}
Platnost: ${this.formatDate(moratorium.validFrom)} - ${this.formatDate(moratorium.validTo)}
Obec: ${moratorium.municipalityCode}
${moratorium.exceptions ? `Výjimky: ${moratorium.exceptions}` : ''}

V této oblasti jsou dočasně omezeny výkopové práce.

Zobrazit moratorium: ${actionUrl}

---
Toto je automaticky generovaný email ze systému DigiKop.
    `;
  }

  private getUserRegisteredHtml(user: User, actionUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Nová registrace uživatele</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .user-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👤 Nová registrace uživatele</h1>
          </div>
          <div class="content">
            <p>Dobrý den,</p>
            <p>zaregistroval se nový uživatel do systému DigiKop:</p>
            
            <div class="user-info">
              <h3>${user.name}</h3>
              <p><strong>Email:</strong> ${user.email}</p>
              <p><strong>Organizace:</strong> ${user.organization || 'Neuvedeno'}</p>
              <p><strong>Registrace:</strong> ${this.formatDateTime(user.createdAt)}</p>
            </div>
            
            <p>Prosím schvalte nebo zamítněte registraci v administračním rozhraní.</p>
            <a href="${actionUrl}" class="button">Spravovat uživatele</a>
          </div>
          <div class="footer">
            <p>Toto je automaticky generovaný email ze systému DigiKop.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getUserRegisteredText(user: User, actionUrl: string): string {
    return `
DigiKop - Nová registrace uživatele

Dobrý den,

zaregistroval se nový uživatel do systému DigiKop:

Jméno: ${user.name}
Email: ${user.email}
Organizace: ${user.organization || 'Neuvedeno'}
Registrace: ${this.formatDateTime(user.createdAt)}

Prosím schvalte nebo zamítněte registraci v administračním rozhraní.

Spravovat uživatele: ${actionUrl}

---
Toto je automaticky generovaný email ze systému DigiKop.
    `;
  }

  // Utility methods for date formatting (delegated to EmailTemplates)
  private formatDate(date: Date): string {
    return EmailTemplates.formatDate(date);
  }

  private formatDateTime(date: Date): string {
    return EmailTemplates.formatDateTime(date);
  }
}

// Export singleton instance
export const emailService = new EmailService();