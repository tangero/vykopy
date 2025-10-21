import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';
import { MapHelper } from '../utils/map-helpers';
import { ProjectHelper } from '../utils/project-helpers';

test.describe('Moratorium Management', () => {
  let authHelper: AuthHelper;
  let mapHelper: MapHelper;
  let projectHelper: ProjectHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    mapHelper = new MapHelper(page);
    projectHelper = new ProjectHelper(page);
  });

  test('coordinator can create moratorium', async ({ page }) => {
    await authHelper.loginAs('coordinator');
    
    await page.goto('/moratoriums/create');
    
    const moratoriumName = `Test Moratorium ${Date.now()}`;
    
    // Fill moratorium details
    await page.fill('[data-testid="moratorium-name"]', moratoriumName);
    await page.selectOption('[data-testid="moratorium-reason"]', 'road_reconstruction');
    await page.fill('[data-testid="reason-detail"]', 'Major road reconstruction project');
    await page.fill('[data-testid="valid-from"]', '2024-12-01');
    await page.fill('[data-testid="valid-to"]', '2025-06-01');
    await page.fill('[data-testid="exceptions"]', 'Emergency repairs allowed');
    
    // Draw moratorium area
    await mapHelper.waitForMapLoad();
    await mapHelper.drawPolygon([
      {x: 350, y: 350},
      {x: 450, y: 350},
      {x: 450, y: 450},
      {x: 350, y: 450}
    ]);
    
    // Create moratorium
    await page.click('[data-testid="create-moratorium"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Moratorium bylo vytvořeno');
    
    // Verify moratorium appears in list
    await page.goto('/moratoriums');
    await expect(page.locator('[data-testid="moratorium-list"]')).toContainText(moratoriumName);
  });

  test('moratorium validation rules', async ({ page }) => {
    await authHelper.loginAs('coordinator');
    
    await page.goto('/moratoriums/create');
    
    // Test maximum duration validation (5 years)
    await page.fill('[data-testid="moratorium-name"]', 'Long Moratorium');
    await page.fill('[data-testid="valid-from"]', '2024-01-01');
    await page.fill('[data-testid="valid-to"]', '2030-01-01'); // 6 years
    
    await mapHelper.waitForMapLoad();
    await mapHelper.drawPoint();
    
    await page.click('[data-testid="create-moratorium"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="error-message"]')).toContainText('maximálně 5 let');
    
    // Fix the date
    await page.fill('[data-testid="valid-to"]', '2029-01-01'); // 5 years
    await page.click('[data-testid="create-moratorium"]');
    
    // Should succeed now
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('moratorium warnings during project creation', async ({ page }) => {
    // First create a moratorium as coordinator
    await authHelper.loginAs('coordinator');
    
    await page.goto('/moratoriums/create');
    
    await page.fill('[data-testid="moratorium-name"]', 'Warning Test Moratorium');
    await page.selectOption('[data-testid="moratorium-reason"]', 'road_reconstruction');
    await page.fill('[data-testid="valid-from"]', '2024-11-01');
    await page.fill('[data-testid="valid-to"]', '2025-11-01');
    
    await mapHelper.waitForMapLoad();
    await mapHelper.drawPolygon();
    
    await page.click('[data-testid="create-moratorium"]');
    
    // Now try to create project in moratorium area as applicant
    await authHelper.logout();
    await authHelper.loginAs('applicant');
    
    const projectName = `Moratorium Test ${Date.now()}`;
    await projectHelper.createProject({
      name: projectName,
      startDate: '2024-12-01',
      endDate: '2024-12-15'
    });
    
    // Should show moratorium warning
    await expect(page.locator('[data-testid="moratorium-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="moratorium-warning"]')).toContainText('Warning Test Moratorium');
    
    // Should still allow submission
    await page.click('[data-testid="proceed-despite-moratorium"]');
    await projectHelper.submitForApproval();
    
    // Verify project is submitted with moratorium flag
    await page.goto('/projects');
    await page.click(`[data-testid="project-row"][data-project-name*="${projectName}"]`);
    await expect(page.locator('[data-testid="moratorium-violation"]')).toBeVisible();
  });

  test('coordinator can approve project despite moratorium', async ({ page }) => {
    // Create project in moratorium area (from previous test setup)
    await authHelper.loginAs('applicant');
    
    const projectName = `Moratorium Override ${Date.now()}`;
    await projectHelper.createProject({
      name: projectName,
      startDate: '2024-12-01',
      endDate: '2024-12-15'
    });
    
    // Submit despite moratorium warning
    await page.click('[data-testid="proceed-despite-moratorium"]');
    await projectHelper.submitForApproval();
    
    // Switch to coordinator
    await authHelper.logout();
    await authHelper.loginAs('coordinator');
    
    await page.goto('/dashboard');
    await page.click(`[data-testid="pending-project"][data-project-name*="${projectName}"]`);
    
    // Should see moratorium warning in coordinator view
    await expect(page.locator('[data-testid="moratorium-violation"]')).toBeVisible();
    
    // Coordinator can still approve
    await page.click('[data-testid="approve-despite-moratorium"]');
    await page.fill('[data-testid="approval-reason"]', 'Emergency infrastructure repair');
    await page.click('[data-testid="confirm-approval"]');
    
    // Verify approval
    await expect(page.locator('[data-testid="project-status"]')).toContainText('Schválen');
    await expect(page.locator('[data-testid="moratorium-exception"]')).toContainText('Emergency infrastructure repair');
  });

  test('moratorium editing and deletion', async ({ page }) => {
    await authHelper.loginAs('coordinator');
    
    // Create moratorium first
    await page.goto('/moratoriums/create');
    
    const originalName = `Editable Moratorium ${Date.now()}`;
    await page.fill('[data-testid="moratorium-name"]', originalName);
    await page.selectOption('[data-testid="moratorium-reason"]', 'utilities_work');
    await page.fill('[data-testid="valid-from"]', '2024-12-01');
    await page.fill('[data-testid="valid-to"]', '2025-06-01');
    
    await mapHelper.waitForMapLoad();
    await mapHelper.drawPoint();
    
    await page.click('[data-testid="create-moratorium"]');
    
    // Edit moratorium
    await page.goto('/moratoriums');
    await page.click(`[data-testid="moratorium-row"][data-moratorium-name*="${originalName}"]`);
    await page.click('[data-testid="edit-moratorium"]');
    
    const updatedName = `${originalName} - Updated`;
    await page.fill('[data-testid="moratorium-name"]', updatedName);
    await page.fill('[data-testid="reason-detail"]', 'Updated reason details');
    
    await page.click('[data-testid="save-changes"]');
    
    // Verify changes
    await expect(page.locator('[data-testid="moratorium-name"]')).toContainText(updatedName);
    
    // Delete moratorium
    await page.click('[data-testid="delete-moratorium"]');
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify deletion
    await page.goto('/moratoriums');
    await expect(page.locator('[data-testid="moratorium-list"]')).not.toContainText(updatedName);
  });

  test('moratorium expiration handling', async ({ page }) => {
    await authHelper.loginAs('coordinator');
    
    // Create expired moratorium
    await page.goto('/moratoriums/create');
    
    await page.fill('[data-testid="moratorium-name"]', 'Expired Moratorium');
    await page.selectOption('[data-testid="moratorium-reason"]', 'road_reconstruction');
    await page.fill('[data-testid="valid-from"]', '2023-01-01');
    await page.fill('[data-testid="valid-to"]', '2023-12-31'); // Expired
    
    await mapHelper.waitForMapLoad();
    await mapHelper.drawPoint();
    
    await page.click('[data-testid="create-moratorium"]');
    
    // Check moratorium list shows expired status
    await page.goto('/moratoriums');
    
    const expiredMoratorium = page.locator('[data-testid="moratorium-row"]').filter({ hasText: 'Expired Moratorium' });
    await expect(expiredMoratorium.locator('[data-testid="status"]')).toContainText('Vypršelo');
    
    // Verify expired moratorium doesn't show warnings for new projects
    await authHelper.logout();
    await authHelper.loginAs('applicant');
    
    await projectHelper.createProject({
      name: 'No Warning Test',
      startDate: '2024-12-01',
      endDate: '2024-12-15'
    });
    
    // Should not show moratorium warning for expired moratorium
    await expect(page.locator('[data-testid="moratorium-warning"]')).not.toBeVisible();
  });

  test('moratorium map visualization', async ({ page }) => {
    await authHelper.loginAs('coordinator');
    
    // Create multiple moratoriums with different reasons
    const moratoriums = [
      { name: 'Road Moratorium', reason: 'road_reconstruction', color: 'red' },
      { name: 'Utilities Moratorium', reason: 'utilities_work', color: 'blue' },
      { name: 'Event Moratorium', reason: 'public_event', color: 'orange' }
    ];
    
    for (const moratorium of moratoriums) {
      await page.goto('/moratoriums/create');
      
      await page.fill('[data-testid="moratorium-name"]', moratorium.name);
      await page.selectOption('[data-testid="moratorium-reason"]', moratorium.reason);
      await page.fill('[data-testid="valid-from"]', '2024-12-01');
      await page.fill('[data-testid="valid-to"]', '2025-06-01');
      
      await mapHelper.waitForMapLoad();
      await mapHelper.drawPolygon([
        {x: 300 + moratoriums.indexOf(moratorium) * 50, y: 300},
        {x: 400 + moratoriums.indexOf(moratorium) * 50, y: 300},
        {x: 400 + moratoriums.indexOf(moratorium) * 50, y: 400},
        {x: 300 + moratoriums.indexOf(moratorium) * 50, y: 400}
      ]);
      
      await page.click('[data-testid="create-moratorium"]');
    }
    
    // View moratoriums on map
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    
    // Toggle moratorium layer
    await mapHelper.toggleLayer('moratoriums');
    
    // Verify all moratoriums are visible
    for (const moratorium of moratoriums) {
      await expect(page.locator(`[data-testid="moratorium-area"][data-name="${moratorium.name}"]`)).toBeVisible();
    }
    
    // Test moratorium tooltips
    await page.hover('[data-testid="moratorium-area"]');
    await expect(page.locator('[data-testid="moratorium-tooltip"]')).toBeVisible();
  });
});