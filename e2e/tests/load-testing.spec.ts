import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';
import { ProjectHelper } from '../utils/project-helpers';

test.describe('Load Testing', () => {
  test('concurrent user sessions', async ({ browser }) => {
    const contexts = [];
    const pages = [];
    const authHelpers = [];
    
    // Create multiple browser contexts to simulate concurrent users
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const authHelper = new AuthHelper(page);
      
      contexts.push(context);
      pages.push(page);
      authHelpers.push(authHelper);
    }
    
    try {
      // Simulate concurrent logins
      const loginPromises = authHelpers.map((helper, index) => {
        const userType = index % 3 === 0 ? 'admin' : index % 3 === 1 ? 'coordinator' : 'applicant';
        return helper.loginAs(userType as any);
      });
      
      const startTime = Date.now();
      await Promise.all(loginPromises);
      const loginDuration = Date.now() - startTime;
      
      console.log(`Concurrent login duration: ${loginDuration}ms`);
      expect(loginDuration).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Simulate concurrent navigation
      const navigationPromises = pages.map(page => page.goto('/projects'));
      
      const navStartTime = Date.now();
      await Promise.all(navigationPromises);
      const navDuration = Date.now() - navStartTime;
      
      console.log(`Concurrent navigation duration: ${navDuration}ms`);
      expect(navDuration).toBeLessThan(8000);
      
      // Verify all pages loaded successfully
      for (const page of pages) {
        await expect(page.locator('[data-testid="project-list"], [data-testid="coordinator-dashboard"], [data-testid="admin-dashboard"]')).toBeVisible();
      }
      
    } finally {
      // Cleanup
      for (const context of contexts) {
        await context.close();
      }
    }
  });

  test('API endpoint stress testing', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    await authHelper.loginAs('applicant');
    
    // Monitor API requests
    const apiRequests: Array<{ url: string, duration: number, status: number }> = [];
    
    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        const timing = response.timing();
        apiRequests.push({
          url: response.url(),
          duration: timing.responseEnd,
          status: response.status()
        });
      }
    });
    
    // Rapid navigation to trigger multiple API calls
    const pages = ['/projects', '/', '/projects/create', '/dashboard'];
    
    for (let i = 0; i < 3; i++) { // Repeat 3 times
      for (const pagePath of pages) {
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500); // Brief pause between requests
      }
    }
    
    // Analyze API performance under load
    const failedRequests = apiRequests.filter(req => req.status >= 400);
    const slowRequests = apiRequests.filter(req => req.duration > 3000);
    const averageResponseTime = apiRequests.reduce((sum, req) => sum + req.duration, 0) / apiRequests.length;
    
    console.log(`Total API requests: ${apiRequests.length}`);
    console.log(`Failed requests: ${failedRequests.length}`);
    console.log(`Slow requests (>3s): ${slowRequests.length}`);
    console.log(`Average response time: ${averageResponseTime.toFixed(2)}ms`);
    
    // Performance assertions
    expect(failedRequests.length).toBeLessThan(apiRequests.length * 0.05); // Less than 5% failure rate
    expect(slowRequests.length).toBeLessThan(apiRequests.length * 0.1); // Less than 10% slow requests
    expect(averageResponseTime).toBeLessThan(2000); // Average under 2 seconds
  });

  test('database performance under concurrent writes', async ({ browser }) => {
    const projectHelper = new ProjectHelper(await browser.newPage());
    const authHelper = new AuthHelper(await browser.newPage());
    
    await authHelper.loginAs('applicant');
    
    // Create multiple projects concurrently
    const projectCreationPromises = [];
    
    for (let i = 0; i < 10; i++) {
      const promise = projectHelper.createProject({
        name: `Load Test Project ${i} ${Date.now()}`,
        contractor: `Test Contractor ${i}`,
        startDate: '2024-12-01',
        endDate: '2024-12-15'
      }).then(() => projectHelper.saveDraft());
      
      projectCreationPromises.push(promise);
    }
    
    const startTime = Date.now();
    await Promise.all(projectCreationPromises);
    const duration = Date.now() - startTime;
    
    console.log(`Concurrent project creation duration: ${duration}ms`);
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
  });

  test('memory usage under extended session', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    await authHelper.loginAs('applicant');
    
    // Monitor memory usage
    const getMemoryUsage = async () => {
      return await page.evaluate(() => {
        return (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        } : null;
      });
    };
    
    const initialMemory = await getMemoryUsage();
    
    // Simulate extended user session with various activities
    const activities = [
      () => page.goto('/projects'),
      () => page.goto('/'),
      () => page.goto('/projects/create'),
      () => page.goto('/dashboard'),
      () => page.click('[data-testid="filters-toggle"]'),
      () => page.selectOption('[data-testid="status-filter"]', 'approved'),
      () => page.click('[data-testid="apply-filters"]'),
    ];
    
    // Repeat activities multiple times to simulate extended usage
    for (let cycle = 0; cycle < 5; cycle++) {
      for (const activity of activities) {
        try {
          await activity();
          await page.waitForTimeout(1000);
        } catch (error) {
          // Continue if activity fails
          console.log(`Activity failed: ${error}`);
        }
      }
      
      // Check memory usage periodically
      const currentMemory = await getMemoryUsage();
      if (initialMemory && currentMemory) {
        const memoryIncrease = currentMemory.used - initialMemory.used;
        console.log(`Memory usage after cycle ${cycle + 1}: ${(currentMemory.used / 1024 / 1024).toFixed(2)}MB`);
        
        // Memory shouldn't grow excessively (more than 100MB increase)
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      }
    }
  });

  test('network bandwidth efficiency', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    await authHelper.loginAs('applicant');
    
    // Monitor all network requests
    const networkData: Array<{ url: string, size: number, type: string, cached: boolean }> = [];
    
    page.on('response', async (response) => {
      const headers = response.headers();
      const contentLength = headers['content-length'];
      const contentType = headers['content-type'] || '';
      const cacheControl = headers['cache-control'] || '';
      
      networkData.push({
        url: response.url(),
        size: contentLength ? parseInt(contentLength) : 0,
        type: contentType,
        cached: cacheControl.includes('max-age') || response.fromServiceWorker()
      });
    });
    
    // Navigate through application
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    await page.goto('/projects/create');
    await page.waitForLoadState('networkidle');
    
    // Analyze network efficiency
    const totalSize = networkData.reduce((sum, req) => sum + req.size, 0);
    const cachedRequests = networkData.filter(req => req.cached);
    const imageRequests = networkData.filter(req => req.type.includes('image'));
    const jsRequests = networkData.filter(req => req.type.includes('javascript'));
    const cssRequests = networkData.filter(req => req.type.includes('css'));
    
    console.log(`Total network size: ${(totalSize / 1024).toFixed(2)}KB`);
    console.log(`Cached requests: ${cachedRequests.length}/${networkData.length}`);
    console.log(`Image requests: ${imageRequests.length} (${(imageRequests.reduce((sum, req) => sum + req.size, 0) / 1024).toFixed(2)}KB)`);
    console.log(`JS requests: ${jsRequests.length} (${(jsRequests.reduce((sum, req) => sum + req.size, 0) / 1024).toFixed(2)}KB)`);
    console.log(`CSS requests: ${cssRequests.length} (${(cssRequests.reduce((sum, req) => sum + req.size, 0) / 1024).toFixed(2)}KB)`);
    
    // Performance assertions
    expect(totalSize).toBeLessThan(10 * 1024 * 1024); // Less than 10MB total
    expect(cachedRequests.length / networkData.length).toBeGreaterThan(0.3); // At least 30% cached
  });
});