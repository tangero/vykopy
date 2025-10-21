import { Page, expect } from '@playwright/test';
import { MapHelper } from './map-helpers';

export class ProjectHelper {
  private mapHelper: MapHelper;

  constructor(private page: Page) {
    this.mapHelper = new MapHelper(page);
  }

  async createProject(projectData: {
    name: string;
    contractor?: string;
    workType?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }) {
    // Navigate to create project page
    await this.page.goto('/projects/create');
    
    // Fill basic information (Step 1)
    await this.page.fill('[data-testid="project-name"]', projectData.name);
    
    if (projectData.contractor) {
      await this.page.fill('[data-testid="contractor-organization"]', projectData.contractor);
    }
    
    if (projectData.description) {
      await this.page.fill('[data-testid="project-description"]', projectData.description);
    }
    
    // Continue to location step
    await this.page.click('[data-testid="next-step-button"]');
    
    // Wait for map to load
    await this.mapHelper.waitForMapLoad();
    
    // Draw location (Step 2)
    await this.mapHelper.drawPoint(400, 300);
    
    // Continue to details step
    await this.page.click('[data-testid="next-step-button"]');
    
    // Fill project details (Step 3)
    if (projectData.workType) {
      await this.page.selectOption('[data-testid="work-type"]', projectData.workType);
    }
    
    if (projectData.category) {
      await this.page.selectOption('[data-testid="work-category"]', projectData.category);
    }
    
    if (projectData.startDate) {
      await this.page.fill('[data-testid="start-date"]', projectData.startDate);
    }
    
    if (projectData.endDate) {
      await this.page.fill('[data-testid="end-date"]', projectData.endDate);
    }
    
    return this;
  }

  async saveDraft() {
    await this.page.click('[data-testid="save-draft-button"]');
    await expect(this.page.locator('[data-testid="success-message"]')).toContainText('uložen');
  }

  async submitForApproval() {
    await this.page.click('[data-testid="submit-approval-button"]');
    
    // Handle conflict warnings if they appear
    const conflictWarning = this.page.locator('[data-testid="conflict-warning"]');
    if (await conflictWarning.isVisible()) {
      await this.page.click('[data-testid="proceed-despite-conflicts"]');
    }
    
    await expect(this.page.locator('[data-testid="success-message"]')).toContainText('odeslán');
  }

  async approveProject(projectId: string) {
    // Navigate to project detail
    await this.page.goto(`/projects/${projectId}`);
    
    // Click approve button
    await this.page.click('[data-testid="approve-project-button"]');
    
    // Confirm approval
    await this.page.click('[data-testid="confirm-approval"]');
    
    await expect(this.page.locator('[data-testid="project-status"]')).toContainText('Schválen');
  }

  async rejectProject(projectId: string, reason: string) {
    // Navigate to project detail
    await this.page.goto(`/projects/${projectId}`);
    
    // Click reject button
    await this.page.click('[data-testid="reject-project-button"]');
    
    // Fill rejection reason
    await this.page.fill('[data-testid="rejection-reason"]', reason);
    
    // Confirm rejection
    await this.page.click('[data-testid="confirm-rejection"]');
    
    await expect(this.page.locator('[data-testid="project-status"]')).toContainText('Zamítnut');
  }

  async addComment(comment: string) {
    await this.page.fill('[data-testid="comment-input"]', comment);
    await this.page.click('[data-testid="add-comment-button"]');
    
    // Wait for comment to appear
    await expect(this.page.locator('[data-testid="comment-list"]')).toContainText(comment);
  }

  async filterProjects(filters: {
    status?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    // Open filters panel
    await this.page.click('[data-testid="filters-toggle"]');
    
    if (filters.status) {
      await this.page.selectOption('[data-testid="status-filter"]', filters.status);
    }
    
    if (filters.category) {
      await this.page.selectOption('[data-testid="category-filter"]', filters.category);
    }
    
    if (filters.dateFrom) {
      await this.page.fill('[data-testid="date-from-filter"]', filters.dateFrom);
    }
    
    if (filters.dateTo) {
      await this.page.fill('[data-testid="date-to-filter"]', filters.dateTo);
    }
    
    // Apply filters
    await this.page.click('[data-testid="apply-filters"]');
  }

  async verifyProjectInList(projectName: string) {
    await expect(this.page.locator('[data-testid="project-list"]')).toContainText(projectName);
  }

  async verifyProjectNotInList(projectName: string) {
    await expect(this.page.locator('[data-testid="project-list"]')).not.toContainText(projectName);
  }
}