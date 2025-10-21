import { Page, expect } from '@playwright/test';
import { testUsers } from '../fixtures/seed-data';

export class AuthHelper {
  constructor(private page: Page) {}

  async loginAs(userType: 'admin' | 'coordinator' | 'applicant') {
    const userMap = {
      admin: testUsers[0],
      coordinator: testUsers[1], 
      applicant: testUsers[2]
    };
    
    const user = userMap[userType];
    
    await this.page.goto('/login');
    await this.page.fill('[data-testid="email-input"]', user.email);
    await this.page.fill('[data-testid="password-input"]', user.password);
    await this.page.click('[data-testid="login-button"]');
    
    // Wait for successful login redirect
    await expect(this.page).toHaveURL(/\/(dashboard|projects)/);
    
    // Verify user is logged in by checking for user menu or name
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="logout-button"]');
    await expect(this.page).toHaveURL('/login');
  }

  async ensureLoggedOut() {
    // Clear any existing session
    await this.page.context().clearCookies();
    await this.page.goto('/login');
  }
}