import { Page, expect, Locator } from '@playwright/test';

export class MapHelper {
  constructor(private page: Page) {}

  async waitForMapLoad() {
    // Wait for map container to be visible
    await expect(this.page.locator('[data-testid="map-container"]')).toBeVisible();
    
    // Wait for map to finish loading
    await this.page.waitForFunction(() => {
      const mapContainer = document.querySelector('[data-testid="map-container"]');
      return mapContainer && (window as any).mapboxgl && (mapContainer as any)._map;
    }, { timeout: 10000 });
    
    // Additional wait for tiles to load
    await this.page.waitForTimeout(2000);
  }

  async clickOnMap(x: number = 400, y: number = 300) {
    const mapContainer = this.page.locator('[data-testid="map-container"]');
    await mapContainer.click({ position: { x, y } });
  }

  async drawPoint(x: number = 400, y: number = 300) {
    // Activate point drawing tool
    await this.page.click('[data-testid="draw-point-tool"]');
    
    // Click on map to place point
    await this.clickOnMap(x, y);
    
    // Wait for point to be drawn
    await expect(this.page.locator('[data-testid="drawn-features"]')).toContainText('Point');
  }

  async drawLine(points: Array<{x: number, y: number}> = [{x: 300, y: 300}, {x: 500, y: 300}]) {
    // Activate line drawing tool
    await this.page.click('[data-testid="draw-line-tool"]');
    
    // Click points to draw line
    for (const point of points) {
      await this.clickOnMap(point.x, point.y);
    }
    
    // Double-click to finish line
    await this.page.dblclick('[data-testid="map-container"]', { 
      position: points[points.length - 1] 
    });
    
    // Wait for line to be drawn
    await expect(this.page.locator('[data-testid="drawn-features"]')).toContainText('LineString');
  }

  async drawPolygon(points: Array<{x: number, y: number}> = [
    {x: 300, y: 300}, 
    {x: 500, y: 300}, 
    {x: 500, y: 500}, 
    {x: 300, y: 500}
  ]) {
    // Activate polygon drawing tool
    await this.page.click('[data-testid="draw-polygon-tool"]');
    
    // Click points to draw polygon
    for (const point of points) {
      await this.clickOnMap(point.x, point.y);
    }
    
    // Click first point again to close polygon
    await this.clickOnMap(points[0].x, points[0].y);
    
    // Wait for polygon to be drawn
    await expect(this.page.locator('[data-testid="drawn-features"]')).toContainText('Polygon');
  }

  async toggleLayer(layerName: string) {
    await this.page.click(`[data-testid="layer-toggle-${layerName}"]`);
  }

  async searchLocation(address: string) {
    await this.page.fill('[data-testid="geocoding-search"]', address);
    await this.page.press('[data-testid="geocoding-search"]', 'Enter');
    
    // Wait for search results
    await expect(this.page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Click first result
    await this.page.click('[data-testid="search-result"]:first-child');
  }

  async verifyProjectOnMap(projectName: string) {
    // Wait for project to appear on map
    await expect(this.page.locator(`[data-testid="project-marker"][title*="${projectName}"]`)).toBeVisible();
  }

  async clickProject(projectName: string) {
    await this.page.click(`[data-testid="project-marker"][title*="${projectName}"]`);
    
    // Wait for project details to open
    await expect(this.page.locator('[data-testid="project-sidebar"]')).toBeVisible();
  }
}