import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';
import { ProjectHelper } from '../utils/project-helpers';
import { MapHelper } from '../utils/map-helpers';

test.describe('Project Workflow', () => {
  let authHelper: AuthHelper;
  let projectHelper: ProjectHelper;
  let mapHelper: MapHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    projectHelper = new ProjectHelper(page);
    mapHelper = new MapHelper(page);
  });

  test('complete project lifecycle - applicant creates, coordinator approves', async ({ page }) => {
    // Step 1: Applicant creates project
    await authHelper.loginAs('applicant');
    
    const projectName = `E2E Test Project ${Date.now()}`;
    await projectHelper.createProject({
      name: projectName,
      contractor: 'Test Contractor s.r.o.',
      workType: 'Výkop pro inženýrské sítě',
      category: 'utilities',
      startDate: '2024-12-01',
      endDate: '2024-12-15',
      description: 'E2E test excavation project'
    });
    
    // Save as draft first
    await projectHelper.saveDraft();
    
    // Verify project appears in applicant's list
    await page.goto('/projects');
    await projectHelper.verifyProjectInList(projectName);
    
    // Submit for approval
    await page.click(`[data-testid="project-row"][data-project-name*="${projectName}"]`);
    await projectHelper.submitForApproval();
    
    // Step 2: Coordinator reviews and approves
    await authHelper.logout();
    await authHelper.loginAs('coordinator');
    
    // Check coordinator dashboard for pending projects
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="pending-projects"]')).toContainText(projectName);
    
    // Navigate to project and approve
    await page.click(`[data-testid="pending-project"][data-project-name*="${projectName}"]`);
    await page.click('[data-testid="approve-project-button"]');
    await page.click('[data-testid="confirm-approval"]');
    
    // Verify approval
    await expect(page.locator('[data-testid="project-status"]')).toContainText('Schválen');
    
    // Step 3: Verify project appears on map
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    await mapHelper.verifyProjectOnMap(projectName);
  });

  test('project rejection workflow', async ({ page }) => {
    // Create project as applicant
    await authHelper.loginAs('applicant');
    
    const projectName = `Rejection Test ${Date.now()}`;
    await projectHelper.createProject({
      name: projectName,
      contractor: 'Test Contractor',
      startDate: '2024-12-01',
      endDate: '2024-12-15'
    });
    
    await projectHelper.submitForApproval();
    
    // Switch to coordinator and reject
    await authHelper.logout();
    await authHelper.loginAs('coordinator');
    
    await page.goto('/dashboard');
    await page.click(`[data-testid="pending-project"][data-project-name*="${projectName}"]`);
    
    const rejectionReason = 'Insufficient documentation provided';
    await projectHelper.rejectProject('', rejectionReason);
    
    // Verify rejection
    await expect(page.locator('[data-testid="project-status"]')).toContainText('Zamítnut');
    await expect(page.locator('[data-testid="rejection-reason"]')).toContainText(rejectionReason);
    
    // Verify applicant can see rejection
    await authHelper.logout();
    await authHelper.loginAs('applicant');
    
    await page.goto('/projects');
    await page.click(`[data-testid="project-row"][data-project-name*="${projectName}"]`);
    await expect(page.locator('[data-testid="project-status"]')).toContainText('Zamítnut');
  });

  test('project with conflicts workflow', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    // Create first project
    const project1Name = `Conflict Test 1 ${Date.now()}`;
    await projectHelper.createProject({
      name: project1Name,
      startDate: '2024-12-01',
      endDate: '2024-12-15'
    });
    await projectHelper.submitForApproval();
    
    // Approve first project
    await authHelper.logout();
    await authHelper.loginAs('coordinator');
    await page.goto('/dashboard');
    await page.click(`[data-testid="pending-project"][data-project-name*="${project1Name}"]`);
    await page.click('[data-testid="approve-project-button"]');
    await page.click('[data-testid="confirm-approval"]');
    
    // Create conflicting project
    await authHelper.logout();
    await authHelper.loginAs('applicant');
    
    const project2Name = `Conflict Test 2 ${Date.now()}`;
    await projectHelper.createProject({
      name: project2Name,
      startDate: '2024-12-05', // Overlapping dates
      endDate: '2024-12-20'
    });
    
    // Should show conflict warning when submitting
    await page.click('[data-testid="submit-approval-button"]');
    await expect(page.locator('[data-testid="conflict-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="conflict-warning"]')).toContainText(project1Name);
    
    // Proceed despite conflicts
    await page.click('[data-testid="proceed-despite-conflicts"]');
    
    // Verify project is marked with conflicts
    await page.goto('/projects');
    await page.click(`[data-testid="project-row"][data-project-name*="${project2Name}"]`);
    await expect(page.locator('[data-testid="conflict-indicator"]')).toBeVisible();
  });

  test('project comments and communication', async ({ page }) => {
    // Create and submit project
    await authHelper.loginAs('applicant');
    
    const projectName = `Comment Test ${Date.now()}`;
    await projectHelper.createProject({
      name: projectName,
      startDate: '2024-12-01',
      endDate: '2024-12-15'
    });
    await projectHelper.submitForApproval();
    
    // Add comment as applicant
    const applicantComment = 'Please review this project urgently';
    await projectHelper.addComment(applicantComment);
    
    // Switch to coordinator and add response
    await authHelper.logout();
    await authHelper.loginAs('coordinator');
    
    await page.goto('/dashboard');
    await page.click(`[data-testid="pending-project"][data-project-name*="${projectName}"]`);
    
    const coordinatorComment = 'We need additional documentation';
    await projectHelper.addComment(coordinatorComment);
    
    // Verify both comments are visible
    await expect(page.locator('[data-testid="comment-list"]')).toContainText(applicantComment);
    await expect(page.locator('[data-testid="comment-list"]')).toContainText(coordinatorComment);
    
    // Verify comment timestamps and authors
    await expect(page.locator('[data-testid="comment-author"]')).toContainText('Test Applicant');
    await expect(page.locator('[data-testid="comment-author"]')).toContainText('Prague Coordinator');
  });

  test('project editing and updates', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    const originalName = `Edit Test ${Date.now()}`;
    await projectHelper.createProject({
      name: originalName,
      description: 'Original description'
    });
    await projectHelper.saveDraft();
    
    // Edit project
    await page.goto('/projects');
    await page.click(`[data-testid="project-row"][data-project-name*="${originalName}"]`);
    await page.click('[data-testid="edit-project-button"]');
    
    const updatedName = `${originalName} - Updated`;
    await page.fill('[data-testid="project-name"]', updatedName);
    await page.fill('[data-testid="project-description"]', 'Updated description');
    
    await page.click('[data-testid="save-changes-button"]');
    
    // Verify changes
    await expect(page.locator('[data-testid="project-name"]')).toContainText(updatedName);
    await expect(page.locator('[data-testid="project-description"]')).toContainText('Updated description');
  });
});