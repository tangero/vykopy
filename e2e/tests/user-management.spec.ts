import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';

test.describe('User Management', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test('regional admin can manage users', async ({ page }) => {
    await authHelper.loginAs('admin');
    
    await page.goto('/admin/users');
    
    // Verify user list is visible
    await expect(page.locator('[data-testid="user-list"]')).toBeVisible();
    
    // Check existing test users are listed
    await expect(page.locator('[data-testid="user-list"]')).toContainText('admin@digikop.cz');
    await expect(page.locator('[data-testid="user-list"]')).toContainText('coordinator@praha.cz');
    await expect(page.locator('[data-testid="user-list"]')).toContainText('applicant@company.cz');
  });

  test('regional admin can create new coordinator', async ({ page }) => {
    await authHelper.loginAs('admin');
    
    await page.goto('/admin/users');
    await page.click('[data-testid="create-user-button"]');
    
    const newUserEmail = `coordinator-${Date.now()}@test.cz`;
    
    // Fill user creation form
    await page.fill('[data-testid="user-email"]', newUserEmail);
    await page.fill('[data-testid="user-name"]', 'New Test Coordinator');
    await page.fill('[data-testid="user-organization"]', 'Test Municipality');
    await page.selectOption('[data-testid="user-role"]', 'municipal_coordinator');
    await page.fill('[data-testid="user-password"]', 'TempPass123!');
    
    await page.click('[data-testid="create-user"]');
    
    // Verify user creation
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Uživatel byl vytvořen');
    
    // Verify user appears in list
    await page.goto('/admin/users');
    await expect(page.locator('[data-testid="user-list"]')).toContainText(newUserEmail);
  });

  test('regional admin can assign territories to coordinator', async ({ page }) => {
    await authHelper.loginAs('admin');
    
    await page.goto('/admin/users');
    
    // Click on coordinator user
    await page.click('[data-testid="user-row"]:has-text("coordinator@praha.cz")');
    
    // Open territory assignment
    await page.click('[data-testid="assign-territories"]');
    
    // Should show map interface for territory selection
    await expect(page.locator('[data-testid="territory-map"]')).toBeVisible();
    
    // Select additional municipality
    await page.click('[data-testid="municipality"][data-code="532789"]'); // Example municipality
    
    await page.click('[data-testid="save-territories"]');
    
    // Verify territory assignment
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Území byla přiřazena');
    
    // Verify in user details
    await expect(page.locator('[data-testid="assigned-territories"]')).toContainText('Praha');
  });

  test('coordinator cannot access admin functions', async ({ page }) => {
    await authHelper.loginAs('coordinator');
    
    // Try to access admin panel
    await page.goto('/admin/users');
    
    // Should be redirected or show access denied
    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
  });

  test('applicant cannot access coordinator functions', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    // Try to access coordinator dashboard
    await page.goto('/dashboard');
    
    // Should show applicant view, not coordinator dashboard
    await expect(page.locator('[data-testid="applicant-projects"]')).toBeVisible();
    await expect(page.locator('[data-testid="coordinator-dashboard"]')).not.toBeVisible();
  });

  test('user registration workflow', async ({ page }) => {
    await authHelper.ensureLoggedOut();
    
    await page.goto('/register');
    
    const newUserEmail = `newuser-${Date.now()}@test.cz`;
    
    // Fill registration form
    await page.fill('[data-testid="register-email"]', newUserEmail);
    await page.fill('[data-testid="register-name"]', 'New Test User');
    await page.fill('[data-testid="register-organization"]', 'Test Company');
    await page.fill('[data-testid="register-password"]', 'NewUser123!');
    await page.fill('[data-testid="register-password-confirm"]', 'NewUser123!');
    
    await page.click('[data-testid="register-button"]');
    
    // Should show pending approval message
    await expect(page.locator('[data-testid="pending-approval"]')).toContainText('čeká na schválení');
    
    // Admin should see pending registration
    await authHelper.loginAs('admin');
    await page.goto('/admin/users');
    
    await expect(page.locator('[data-testid="pending-users"]')).toContainText(newUserEmail);
    
    // Approve registration
    await page.click(`[data-testid="approve-user"][data-email="${newUserEmail}"]`);
    
    // Verify approval
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Uživatel byl schválen');
  });

  test('user profile management', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    await page.goto('/profile');
    
    // Verify current profile information
    await expect(page.locator('[data-testid="profile-email"]')).toHaveValue('applicant@company.cz');
    await expect(page.locator('[data-testid="profile-name"]')).toHaveValue('Test Applicant');
    
    // Update profile
    await page.fill('[data-testid="profile-name"]', 'Updated Test Applicant');
    await page.fill('[data-testid="profile-organization"]', 'Updated Company s.r.o.');
    
    await page.click('[data-testid="save-profile"]');
    
    // Verify update
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Profil byl aktualizován');
    
    // Verify changes persist after reload
    await page.reload();
    await expect(page.locator('[data-testid="profile-name"]')).toHaveValue('Updated Test Applicant');
  });

  test('password change functionality', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    await page.goto('/profile');
    await page.click('[data-testid="change-password-tab"]');
    
    // Fill password change form
    await page.fill('[data-testid="current-password"]', 'Apply123!');
    await page.fill('[data-testid="new-password"]', 'NewApply123!');
    await page.fill('[data-testid="confirm-password"]', 'NewApply123!');
    
    await page.click('[data-testid="change-password"]');
    
    // Verify password change
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Heslo bylo změněno');
    
    // Test login with new password
    await authHelper.logout();
    
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'applicant@company.cz');
    await page.fill('[data-testid="password-input"]', 'NewApply123!');
    await page.click('[data-testid="login-button"]');
    
    // Should login successfully
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('user deactivation and reactivation', async ({ page }) => {
    await authHelper.loginAs('admin');
    
    await page.goto('/admin/users');
    
    // Find and deactivate a user
    await page.click('[data-testid="user-row"]:has-text("applicant@company.cz")');
    await page.click('[data-testid="deactivate-user"]');
    await page.click('[data-testid="confirm-deactivation"]');
    
    // Verify deactivation
    await expect(page.locator('[data-testid="user-status"]')).toContainText('Neaktivní');
    
    // Test that deactivated user cannot login
    await authHelper.logout();
    
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'applicant@company.cz');
    await page.fill('[data-testid="password-input"]', 'NewApply123!');
    await page.click('[data-testid="login-button"]');
    
    // Should show account deactivated message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Účet je deaktivován');
    
    // Reactivate user
    await authHelper.loginAs('admin');
    await page.goto('/admin/users');
    await page.click('[data-testid="user-row"]:has-text("applicant@company.cz")');
    await page.click('[data-testid="reactivate-user"]');
    
    // Verify reactivation
    await expect(page.locator('[data-testid="user-status"]')).toContainText('Aktivní');
  });

  test('territorial access restrictions', async ({ page }) => {
    await authHelper.loginAs('coordinator');
    
    // Coordinator should only see projects in their territory
    await page.goto('/projects');
    
    // Should see projects in Praha (assigned territory)
    await expect(page.locator('[data-testid="project-list"]')).toContainText('Praha');
    
    // Should not see projects from other municipalities
    // (This would require test data from multiple municipalities)
    
    // Try to access project outside territory directly
    // This would need a project ID from outside Praha territory
    await page.goto('/projects/550e8400-e29b-41d4-a716-446655440999'); // Non-existent or outside territory
    
    // Should show access denied or not found
    await expect(page.locator('[data-testid="access-denied"], [data-testid="not-found"]')).toBeVisible();
  });
});