import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';

test.describe('Authentication Flow', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.ensureLoggedOut();
  });

  test('should login as regional administrator', async ({ page }) => {
    await authHelper.loginAs('admin');
    
    // Verify admin dashboard is accessible
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Regional Administrator');
  });

  test('should login as municipal coordinator', async ({ page }) => {
    await authHelper.loginAs('coordinator');
    
    // Verify coordinator dashboard
    await expect(page.locator('[data-testid="coordinator-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Municipal Coordinator');
  });

  test('should login as applicant', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    // Verify applicant view
    await expect(page.locator('[data-testid="applicant-projects"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Applicant');
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'invalid@email.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Neplatné přihlašovací údaje');
  });

  test('should logout successfully', async ({ page }) => {
    await authHelper.loginAs('applicant');
    await authHelper.logout();
    
    // Verify redirect to login page
    await expect(page).toHaveURL('/login');
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
    
    await page.goto('/projects');
    await expect(page).toHaveURL('/login');
  });

  test('should maintain session after page refresh', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    // Refresh page
    await page.reload();
    
    // Should still be logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });
});