interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class CacheService {
  private cache = new Map<string, CacheItem<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Set item in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Clean up expired items periodically
    this.cleanupExpired();
  }

  /**
   * Get item from cache if not expired
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    keys: string[];
    memoryUsage: number;
  } {
    const keys = Array.from(this.cache.keys());
    const memoryUsage = JSON.stringify(Array.from(this.cache.entries())).length;
    
    return {
      size: this.cache.size,
      keys,
      memoryUsage
    };
  }

  /**
   * Clean up expired items
   */
  private cleanupExpired(): void {
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Cache API response with automatic key generation
   */
  async cacheApiCall<T>(
    url: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cacheKey = `api:${url}`;
    
    // Try to get from cache first
    const cached = this.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    try {
      const data = await fetchFn();
      this.set(cacheKey, data, ttl);
      return data;
    } catch (error) {
      console.error(`Failed to fetch and cache ${url}:`, error);
      throw error;
    }
  }

  /**
   * Cache map tile URLs for offline capability
   */
  cacheMapTile(tileUrl: string, tileData: Blob): void {
    const cacheKey = `tile:${tileUrl}`;
    this.set(cacheKey, tileData, 24 * 60 * 60 * 1000); // 24 hours TTL for tiles
  }

  /**
   * Get cached map tile
   */
  getCachedMapTile(tileUrl: string): Blob | null {
    const cacheKey = `tile:${tileUrl}`;
    return this.get<Blob>(cacheKey);
  }

  /**
   * Preload critical data
   */
  async preloadCriticalData(): Promise<void> {
    const criticalEndpoints = [
      '/api/auth/me',
      '/api/projects?limit=20',
      '/api/moratoriums/active'
    ];

    const preloadPromises = criticalEndpoints.map(async (endpoint) => {
      try {
        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          this.set(`preload:${endpoint}`, data, 2 * 60 * 1000); // 2 minutes TTL
        }
      } catch (error) {
        console.warn(`Failed to preload ${endpoint}:`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
  }
}

// Create singleton instance
export const cacheService = new CacheService();

// Enhanced fetch function with caching
export const cachedFetch = async <T>(
  url: string,
  options: RequestInit = {},
  ttl: number = 5 * 60 * 1000
): Promise<T> => {
  return cacheService.cacheApiCall(url, async () => {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }, ttl);
};

// Map tile caching utilities
export const setupMapTileCaching = () => {
  // Intercept map tile requests if using service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('Service worker registration failed:', error);
    });
  }
};

export default cacheService;