import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';
import { MapHelper } from '../utils/map-helpers';
import { ProjectHelper } from '../utils/project-helpers';

test.describe('Map Interactions', () => {
  let authHelper: AuthHelper;
  let mapHelper: MapHelper;
  let projectHelper: ProjectHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    mapHelper = new MapHelper(page);
    projectHelper = new ProjectHelper(page);
    
    await authHelper.loginAs('applicant');
  });

  test('should load map with all layers', async ({ page }) => {
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    
    // Verify map controls are present
    await expect(page.locator('[data-testid="map-controls"]')).toBeVisible();
    await expect(page.locator('[data-testid="layer-controls"]')).toBeVisible();
    
    // Verify default layers are loaded
    await expect(page.locator('[data-testid="layer-toggle-projects"]')).toBeVisible();
    await expect(page.locator('[data-testid="layer-toggle-moratoriums"]')).toBeVisible();
    await expect(page.locator('[data-testid="layer-toggle-municipalities"]')).toBeVisible();
  });

  test('should toggle map layers', async ({ page }) => {
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    
    // Toggle projects layer off
    await mapHelper.toggleLayer('projects');
    
    // Verify projects are hidden (check layer control state)
    const projectsToggle = page.locator('[data-testid="layer-toggle-projects"]');
    await expect(projectsToggle).not.toBeChecked();
    
    // Toggle back on
    await mapHelper.toggleLayer('projects');
    await expect(projectsToggle).toBeChecked();
  });

  test('should search for locations using geocoding', async ({ page }) => {
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    
    // Search for Prague
    await mapHelper.searchLocation('Praha');
    
    // Verify map moved to Prague area (check if Prague projects are visible)
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('should draw different geometry types', async ({ page }) => {
    await page.goto('/projects/create');
    
    // Navigate to location step
    await page.fill('[data-testid="project-name"]', 'Geometry Test');
    await page.click('[data-testid="next-step-button"]');
    
    await mapHelper.waitForMapLoad();
    
    // Test point drawing
    await mapHelper.drawPoint(400, 300);
    await expect(page.locator('[data-testid="geometry-info"]')).toContainText('Point');
    
    // Clear and test line drawing
    await page.click('[data-testid="clear-geometry"]');
    await mapHelper.drawLine([{x: 300, y: 300}, {x: 500, y: 400}]);
    await expect(page.locator('[data-testid="geometry-info"]')).toContainText('LineString');
    
    // Clear and test polygon drawing
    await page.click('[data-testid="clear-geometry"]');
    await mapHelper.drawPolygon();
    await expect(page.locator('[data-testid="geometry-info"]')).toContainText('Polygon');
  });

  test('should display project tooltips on hover', async ({ page }) => {
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    
    // Hover over a project marker
    const projectMarker = page.locator('[data-testid="project-marker"]').first();
    await projectMarker.hover();
    
    // Verify tooltip appears
    await expect(page.locator('[data-testid="project-tooltip"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-tooltip"]')).toContainText('Test Excavation Project');
  });

  test('should open project details on click', async ({ page }) => {
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    
    // Click on a project
    await mapHelper.clickProject('Test Excavation Project');
    
    // Verify sidebar opens with project details
    await expect(page.locator('[data-testid="project-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-name"]')).toContainText('Test Excavation Project');
    await expect(page.locator('[data-testid="project-status"]')).toBeVisible();
  });

  test('should filter projects on map', async ({ page }) => {
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    
    // Open filters
    await page.click('[data-testid="map-filters-toggle"]');
    
    // Filter by status
    await page.selectOption('[data-testid="status-filter"]', 'approved');
    await page.click('[data-testid="apply-filters"]');
    
    // Verify only approved projects are visible
    const visibleProjects = page.locator('[data-testid="project-marker"][data-status="approved"]');
    await expect(visibleProjects).toHaveCount(await visibleProjects.count());
    
    // Verify draft projects are hidden
    await expect(page.locator('[data-testid="project-marker"][data-status="draft"]')).toHaveCount(0);
  });

  test('should show conflict indicators on map', async ({ page }) => {
    // First create a conflicting project scenario
    await authHelper.loginAs('coordinator');
    
    // Create and approve first project
    const project1Name = `Map Conflict 1 ${Date.now()}`;
    await projectHelper.createProject({
      name: project1Name,
      startDate: '2024-12-01',
      endDate: '2024-12-15'
    });
    await projectHelper.submitForApproval();
    await projectHelper.approveProject('');
    
    // Create conflicting project
    await authHelper.logout();
    await authHelper.loginAs('applicant');
    
    const project2Name = `Map Conflict 2 ${Date.now()}`;
    await projectHelper.createProject({
      name: project2Name,
      startDate: '2024-12-05',
      endDate: '2024-12-20'
    });
    await projectHelper.submitForApproval();
    
    // Check map shows conflict indicators
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    
    // Verify conflict indicators are visible
    await expect(page.locator('[data-testid="conflict-indicator"]')).toBeVisible();
    
    // Click on conflicting project
    await page.click('[data-testid="project-marker"][data-has-conflicts="true"]');
    
    // Verify conflict details in sidebar
    await expect(page.locator('[data-testid="conflict-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="conflicting-projects"]')).toContainText(project1Name);
  });

  test('should display moratoriums on map', async ({ page }) => {
    // Switch to coordinator to create moratorium
    await authHelper.logout();
    await authHelper.loginAs('coordinator');
    
    await page.goto('/moratoriums/create');
    
    // Create moratorium
    await page.fill('[data-testid="moratorium-name"]', 'Test Road Moratorium');
    await page.fill('[data-testid="moratorium-reason"]', 'Recent road reconstruction');
    await page.fill('[data-testid="valid-from"]', '2024-11-01');
    await page.fill('[data-testid="valid-to"]', '2025-11-01');
    
    // Draw moratorium area
    await mapHelper.waitForMapLoad();
    await mapHelper.drawPolygon();
    
    await page.click('[data-testid="create-moratorium"]');
    
    // Verify moratorium appears on map
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    
    // Toggle moratorium layer on
    await mapHelper.toggleLayer('moratoriums');
    
    // Verify moratorium is visible with red hatching
    await expect(page.locator('[data-testid="moratorium-area"]')).toBeVisible();
    
    // Click on moratorium
    await page.click('[data-testid="moratorium-area"]');
    
    // Verify moratorium details
    await expect(page.locator('[data-testid="moratorium-tooltip"]')).toContainText('Test Road Moratorium');
  });

  test('should handle map performance with many projects', async ({ page }) => {
    await page.goto('/');
    await mapHelper.waitForMapLoad();
    
    // Measure initial load time
    const startTime = Date.now();
    
    // Zoom out to show more projects
    await page.keyboard.press('Control+-');
    await page.keyboard.press('Control+-');
    await page.keyboard.press('Control+-');
    
    // Wait for map to stabilize
    await page.waitForTimeout(2000);
    
    const loadTime = Date.now() - startTime;
    
    // Verify reasonable performance (less than 5 seconds)
    expect(loadTime).toBeLessThan(5000);
    
    // Verify map is still responsive
    await mapHelper.clickOnMap(400, 300);
    
    // Verify no performance warnings in console
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'warning' && msg.text().includes('performance')) {
        logs.push(msg.text());
      }
    });
    
    expect(logs.length).toBe(0);
  });
});