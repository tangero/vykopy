import { User, Project, ProjectComment, Moratorium } from '../types';
import { config } from '../config';

/**
 * Email template utilities and shared components
 */
export class EmailTemplates {
  
  /**
   * Get base HTML template structure
   */
  static getBaseTemplate(title: string, headerColor: string, content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0;
            background-color: #f5f5f5;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header { 
            background: ${headerColor}; 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content { 
            padding: 30px 20px; 
            background: white; 
          }
          .button { 
            display: inline-block; 
            background: ${headerColor}; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0;
            font-weight: 500;
          }
          .button:hover {
            opacity: 0.9;
          }
          .info-box { 
            background: #f8fafc; 
            border: 1px solid #e2e8f0;
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
          }
          .info-box h3 {
            margin-top: 0;
            color: #1e293b;
          }
          .warning-box { 
            background: #fef3c7; 
            border-left: 4px solid #f59e0b; 
            padding: 20px; 
            margin: 20px 0; 
          }
          .footer { 
            text-align: center; 
            padding: 20px; 
            color: #64748b; 
            font-size: 14px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
          }
          .footer a {
            color: #3b82f6;
            text-decoration: none;
          }
          .meta-info {
            font-size: 14px;
            color: #64748b;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
          }
          .status-approved { background: #dcfce7; color: #166534; }
          .status-rejected { background: #fee2e2; color: #991b1b; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-in-progress { background: #dbeafe; color: #1e40af; }
          
          @media (max-width: 600px) {
            .container { margin: 0; }
            .content { padding: 20px 15px; }
            .header { padding: 20px 15px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${content}
          <div class="footer">
            <p>
              Toto je automaticky generovaný email ze systému 
              <a href="${config.frontendUrl}">DigiKop</a>.<br>
              Neodpovídejte na tento email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Format project information box
   */
  static formatProjectInfo(project: Project): string {
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

    const statusClass = `status-${project.state.replace('_', '-')}`;

    return `
      <div class="info-box">
        <h3>${project.name}</h3>
        <p><strong>Stav:</strong> <span class="status-badge ${statusClass}">${stateLabels[project.state] || project.state}</span></p>
        <p><strong>Žadatel:</strong> ${project.contractorOrganization || 'Neuvedeno'}</p>
        <p><strong>Termín realizace:</strong> ${this.formatDate(project.startDate)} - ${this.formatDate(project.endDate)}</p>
        <p><strong>Kategorie:</strong> ${project.workCategory}</p>
        <p><strong>Typ práce:</strong> ${project.workType}</p>
        ${project.description ? `<p><strong>Popis:</strong> ${project.description}</p>` : ''}
        ${project.affectedMunicipalities?.length ? `<p class="meta-info"><strong>Dotčené obce:</strong> ${project.affectedMunicipalities.join(', ')}</p>` : ''}
      </div>
    `;
  }

  /**
   * Format user information box
   */
  static formatUserInfo(user: User): string {
    const roleLabels: Record<string, string> = {
      'regional_admin': 'Krajský administrátor',
      'municipal_coordinator': 'Obecní koordinátor',
      'applicant': 'Žadatel'
    };

    return `
      <div class="info-box">
        <h3>${user.name}</h3>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Role:</strong> ${roleLabels[user.role] || user.role}</p>
        <p><strong>Organizace:</strong> ${user.organization || 'Neuvedeno'}</p>
        <p class="meta-info"><strong>Registrace:</strong> ${this.formatDateTime(user.createdAt)}</p>
      </div>
    `;
  }

  /**
   * Format moratorium information box
   */
  static formatMoratoriumInfo(moratorium: Moratorium): string {
    return `
      <div class="info-box">
        <h3>${moratorium.name}</h3>
        <p><strong>Důvod:</strong> ${moratorium.reason}</p>
        ${moratorium.reasonDetail ? `<p><strong>Detail:</strong> ${moratorium.reasonDetail}</p>` : ''}
        <p><strong>Platnost:</strong> ${this.formatDate(moratorium.validFrom)} - ${this.formatDate(moratorium.validTo)}</p>
        <p><strong>Obec:</strong> ${moratorium.municipalityCode}</p>
        ${moratorium.exceptions ? `<p><strong>Výjimky:</strong> ${moratorium.exceptions}</p>` : ''}
      </div>
    `;
  }

  /**
   * Format conflict list
   */
  static formatConflictList(conflicts: Project[]): string {
    if (conflicts.length === 0) {
      return '<p>Žádné konflikty nebyly detekovány.</p>';
    }

    const conflictItems = conflicts.map(conflict => 
      `<li><strong>${conflict.name}</strong><br>
       <span class="meta-info">${this.formatDate(conflict.startDate)} - ${this.formatDate(conflict.endDate)}</span></li>`
    ).join('');

    return `
      <div class="warning-box">
        <h4>⚠️ Detekované konflikty:</h4>
        <ul>${conflictItems}</ul>
      </div>
    `;
  }

  /**
   * Format comment box
   */
  static formatComment(comment: ProjectComment): string {
    return `
      <div class="info-box">
        <h4>💬 Nový komentář</h4>
        <p>${comment.content}</p>
        <p class="meta-info">Přidáno: ${this.formatDateTime(comment.createdAt)}</p>
        ${comment.attachmentUrl ? `<p class="meta-info">📎 <a href="${comment.attachmentUrl}">Příloha</a></p>` : ''}
      </div>
    `;
  }

  /**
   * Create action button
   */
  static createActionButton(url: string, text: string, color?: string): string {
    const buttonColor = color || '#2563eb';
    return `<a href="${url}" class="button" style="background: ${buttonColor};">${text}</a>`;
  }

  /**
   * Format date in Czech locale
   */
  static formatDate(date: Date): string {
    return new Intl.DateTimeFormat('cs-CZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }

  /**
   * Format date and time in Czech locale
   */
  static formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('cs-CZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  /**
   * Calculate days until date
   */
  static getDaysUntil(date: Date): number {
    return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Format days with proper Czech pluralization
   */
  static formatDays(days: number): string {
    if (days === 1) return '1 den';
    if (days >= 2 && days <= 4) return `${days} dny`;
    return `${days} dní`;
  }

  /**
   * Get color scheme for different notification types
   */
  static getColorScheme(type: string): { primary: string; secondary: string } {
    const schemes: Record<string, { primary: string; secondary: string }> = {
      'success': { primary: '#16a34a', secondary: '#dcfce7' },
      'warning': { primary: '#f59e0b', secondary: '#fef3c7' },
      'error': { primary: '#dc2626', secondary: '#fee2e2' },
      'info': { primary: '#2563eb', secondary: '#dbeafe' },
      'neutral': { primary: '#64748b', secondary: '#f1f5f9' }
    };

    return schemes[type] || schemes['info']!;
  }
}