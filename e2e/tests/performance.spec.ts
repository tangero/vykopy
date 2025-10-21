import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';
import { MapHelper } from '../utils/map-helpers';

test.describe('Performance Tests', () => {
  let authHelper: AuthHelper;
  let mapHelper: MapHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    mapHelper = new MapHelper(page);
  });

  test('page load performance', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    // Measure main page load time
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    console.log(`Main page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    
    // Measure map load time
    const mapStartTime = Date.now();
    await mapHelper.waitForMapLoad();
    const mapLoadTime = Date.now() - mapStartTime;
    
    console.log(`Map load time: ${mapLoadTime}ms`);
    expect(mapLoadTime).toBeLessThan(5000); // Map should load within 5 seconds
  });

  test('API response times', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    // Monitor network requests
    const apiRequests: Array<{ url: string, duration: number }> = [];
    
    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        const request = response.request();
        const timing = response.timing();
        apiRequests.push({
          url: response.url(),
          duration: timing.responseEnd
        });
      }
    });
    
    // Navigate to projects page to trigger API calls
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // Check API response times
    for (const request of apiRequests) {
      console.log(`API ${request.url}: ${request.duration}ms`);
      expect(request.duration).toBeLessThan(2000); // API calls should complete within 2 seconds
    }
  });

  test('map rendering performance with many projects', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    
    // Measure map interaction performance
    const interactions = [
      () => page.keyboard.press('Control++'), // Zoom in
      () => page.keyboard.press('Control+-'), // Zoom out
      () => mapHelper.clickOnMap(400, 300), // Click on map
      () => mapHelper.toggleLayer('projects'), // Toggle layer
      () => mapHelper.toggleLayer('projects'), // Toggle back
    ];
    
    for (const interaction of interactions) {
      const startTime = performance.now();
      await interaction();
      await page.waitForTimeout(100); // Small delay for interaction to complete
      const duration = performance.now() - startTime;
      
      console.log(`Map interaction duration: ${duration}ms`);
      expect(duration).toBeLessThan(500); // Interactions should be responsive
    }
  });

  test('form submission performance', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    await page.goto('/projects/create');
    
    // Fill form quickly
    await page.fill('[data-testid="project-name"]', 'Performance Test Project');
    await page.fill('[data-testid="contractor-organization"]', 'Test Contractor');
    
    // Measure form navigation
    const stepStartTime = Date.now();
    await page.click('[data-testid="next-step-button"]');
    await mapHelper.waitForMapLoad();
    const stepDuration = Date.now() - stepStartTime;
    
    console.log(`Form step navigation: ${stepDuration}ms`);
    expect(stepDuration).toBeLessThan(2000);
    
    // Measure geometry drawing
    const drawStartTime = Date.now();
    await mapHelper.drawPoint();
    const drawDuration = Date.now() - drawStartTime;
    
    console.log(`Geometry drawing: ${drawDuration}ms`);
    expect(drawDuration).toBeLessThan(1000);
    
    // Continue to final step
    await page.click('[data-testid="next-step-button"]');
    
    // Fill remaining fields
    await page.selectOption('[data-testid="work-type"]', 'utilities');
    await page.fill('[data-testid="start-date"]', '2024-12-01');
    await page.fill('[data-testid="end-date"]', '2024-12-15');
    
    // Measure form submission
    const submitStartTime = Date.now();
    await page.click('[data-testid="save-draft-button"]');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    const submitDuration = Date.now() - submitStartTime;
    
    console.log(`Form submission: ${submitDuration}ms`);
    expect(submitDuration).toBeLessThan(3000);
  });

  test('conflict detection performance', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    // Create project that will trigger conflict detection
    await page.goto('/projects/create');
    
    await page.fill('[data-testid="project-name"]', 'Conflict Performance Test');
    await page.click('[data-testid="next-step-button"]');
    
    await mapHelper.waitForMapLoad();
    await mapHelper.drawPoint(400, 300); // Same location as existing test project
    
    await page.click('[data-testid="next-step-button"]');
    
    await page.selectOption('[data-testid="work-type"]', 'utilities');
    await page.fill('[data-testid="start-date"]', '2024-12-01');
    await page.fill('[data-testid="end-date"]', '2024-12-15');
    
    // Measure conflict detection time
    const conflictStartTime = Date.now();
    await page.click('[data-testid="submit-approval-button"]');
    
    // Wait for conflict detection to complete
    await expect(page.locator('[data-testid="conflict-warning"], [data-testid="success-message"]')).toBeVisible();
    const conflictDuration = Date.now() - conflictStartTime;
    
    console.log(`Conflict detection: ${conflictDuration}ms`);
    expect(conflictDuration).toBeLessThan(10000); // Should complete within 10 seconds as per requirements
  });

  test('large dataset handling', async ({ page }) => {
    await authHelper.loginAs('coordinator');
    
    // Navigate to projects list which should show all projects
    const startTime = Date.now();
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    console.log(`Large dataset load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);
    
    // Test pagination performance
    if (await page.locator('[data-testid="pagination"]').isVisible()) {
      const paginationStartTime = Date.now();
      await page.click('[data-testid="next-page"]');
      await page.waitForLoadState('networkidle');
      const paginationDuration = Date.now() - paginationStartTime;
      
      console.log(`Pagination navigation: ${paginationDuration}ms`);
      expect(paginationDuration).toBeLessThan(2000);
    }
    
    // Test filtering performance
    const filterStartTime = Date.now();
    await page.click('[data-testid="filters-toggle"]');
    await page.selectOption('[data-testid="status-filter"]', 'approved');
    await page.click('[data-testid="apply-filters"]');
    await page.waitForLoadState('networkidle');
    const filterDuration = Date.now() - filterStartTime;
    
    console.log(`Filtering duration: ${filterDuration}ms`);
    expect(filterDuration).toBeLessThan(3000);
  });

  test('memory usage monitoring', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    // Monitor memory usage during navigation
    await page.goto('/');
    
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
    });
    
    // Navigate through different pages
    const pages = ['/', '/projects', '/projects/create', '/dashboard'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      if (pagePath === '/') {
        await mapHelper.waitForMapLoad();
      }
      
      const currentMemory = await page.evaluate(() => {
        return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
      });
      
      if (initialMemory > 0 && currentMemory > 0) {
        const memoryIncrease = currentMemory - initialMemory;
        console.log(`Memory usage on ${pagePath}: ${(currentMemory / 1024 / 1024).toFixed(2)}MB`);
        
        // Memory shouldn't increase by more than 50MB during normal navigation
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      }
    }
  });

  test('network efficiency', async ({ page }) => {
    await authHelper.loginAs('applicant');
    
    // Monitor network requests
    const networkRequests: Array<{ url: string, size: number, type: string }> = [];
    
    page.on('response', async (response) => {
      const headers = response.headers();
      const contentLength = headers['content-length'];
      const contentType = headers['content-type'] || '';
      
      networkRequests.push({
        url: response.url(),
        size: contentLength ? parseInt(contentLength) : 0,
        type: contentType
      });
    });
    
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    
    // Analyze network efficiency
    const totalSize = networkRequests.reduce((sum, req) => sum + req.size, 0);
    const apiRequests = networkRequests.filter(req => req.url.includes('/api/'));
    const staticAssets = networkRequests.filter(req => 
      req.type.includes('javascript') || req.type.includes('css') || req.type.includes('image')
    );
    
    console.log(`Total network size: ${(totalSize / 1024).toFixed(2)}KB`);
    console.log(`API requests: ${apiRequests.length}`);
    console.log(`Static assets: ${staticAssets.length}`);
    
    // Check for reasonable limits
    expect(totalSize).toBeLessThan(5 * 1024 * 1024); // Less than 5MB total
    expect(apiRequests.length).toBeLessThan(20); // Reasonable number of API calls
    
    // Check for duplicate requests
    const urls = networkRequests.map(req => req.url);
    const uniqueUrls = new Set(urls);
    const duplicateRatio = (urls.length - uniqueUrls.size) / urls.length;
    
    console.log(`Duplicate request ratio: ${(duplicateRatio * 100).toFixed(2)}%`);
    expect(duplicateRatio).toBeLessThan(0.1); // Less than 10% duplicate requests
  });
});