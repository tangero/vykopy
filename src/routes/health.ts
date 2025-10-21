import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { emailService } from '../services/EmailService';
import { config } from '../config';

const router = Router();
let db: Pool;

export const initializeHealthRoutes = (database: Pool) => {
  db = database;
};

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  database: 'connected' | 'disconnected' | 'error';
  services: {
    email: 'connected' | 'disconnected' | 'error';
    storage: 'available' | 'unavailable' | 'error';
  };
  performance?: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  errors?: string[];
}

// GET /api/health - Basic health check
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const startTime = process.hrtime();
  const errors: string[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Check database connectivity
  let databaseStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  try {
    const result = await db.query('SELECT 1 as health_check, NOW() as timestamp');
    if (result.rows.length > 0) {
      databaseStatus = 'connected';
    }
  } catch (error) {
    databaseStatus = 'error';
    errors.push(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    overallStatus = 'unhealthy';
  }

  // Check PostGIS extension
  try {
    await db.query('SELECT PostGIS_Version()');
  } catch (error) {
    errors.push('PostGIS extension not available');
    overallStatus = 'degraded';
  }

  // Check email service
  let emailStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  try {
    const isEmailConnected = await emailService.verifyConnection();
    emailStatus = isEmailConnected ? 'connected' : 'disconnected';
    if (!isEmailConnected) {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    }
  } catch (error) {
    emailStatus = 'error';
    errors.push(`Email service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    overallStatus = 'degraded';
  }

  // Check storage availability
  let storageStatus: 'available' | 'unavailable' | 'error' = 'available';
  try {
    const fs = await import('fs/promises');
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    await fs.access(uploadPath);
  } catch (error) {
    storageStatus = 'error';
    errors.push('Storage directory not accessible');
    overallStatus = 'degraded';
  }

  const [seconds, nanoseconds] = process.hrtime(startTime);
  const responseTime = seconds * 1000 + nanoseconds / 1000000;

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    database: databaseStatus,
    services: {
      email: emailStatus,
      storage: storageStatus
    }
  };

  // Include performance metrics if requested
  if (req.query.include === 'performance') {
    healthStatus.performance = {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }

  // Include errors if any
  if (errors.length > 0) {
    healthStatus.errors = errors;
  }

  // Set appropriate HTTP status code
  const statusCode = overallStatus === 'healthy' ? 200 : 
                    overallStatus === 'degraded' ? 200 : 503;

  res.status(statusCode).json(healthStatus);
});

// GET /api/health/detailed - Detailed health check with more metrics
router.get('/detailed', async (req: Request, res: Response): Promise<void> => {
  const startTime = process.hrtime();
  const errors: string[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Database detailed checks
  const databaseChecks = {
    connectivity: false,
    postgis: false,
    queryPerformance: 0,
    connectionCount: 0
  };

  try {
    // Basic connectivity
    const connectStart = process.hrtime();
    const result = await db.query('SELECT 1 as health_check, NOW() as timestamp');
    const [seconds, nanoseconds] = process.hrtime(connectStart);
    databaseChecks.queryPerformance = seconds * 1000 + nanoseconds / 1000000;
    databaseChecks.connectivity = result.rows.length > 0;

    // PostGIS check
    try {
      await db.query('SELECT PostGIS_Version()');
      databaseChecks.postgis = true;
    } catch (error) {
      errors.push('PostGIS extension not available');
    }

    // Connection count
    try {
      const connResult = await db.query('SELECT count(*) as connections FROM pg_stat_activity');
      databaseChecks.connectionCount = parseInt(connResult.rows[0].connections);
    } catch (error) {
      errors.push('Could not retrieve connection count');
    }

  } catch (error) {
    errors.push(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    overallStatus = 'unhealthy';
  }

  // Check critical tables exist
  const tableChecks = {
    users: false,
    projects: false,
    moratoriums: false,
    project_comments: false,
    audit_logs: false
  };

  try {
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'projects', 'moratoriums', 'project_comments', 'audit_logs')
    `;
    const tableResult = await db.query(tableQuery);
    tableResult.rows.forEach(row => {
      tableChecks[row.table_name as keyof typeof tableChecks] = true;
    });
  } catch (error) {
    errors.push('Could not verify table structure');
    overallStatus = 'degraded';
  }

  // Check indexes exist
  const indexChecks = {
    spatialIndexes: false,
    performanceIndexes: false
  };

  try {
    const indexQuery = `
      SELECT count(*) as spatial_indexes
      FROM pg_indexes 
      WHERE indexdef LIKE '%USING gist%' 
      AND (tablename = 'projects' OR tablename = 'moratoriums')
    `;
    const indexResult = await db.query(indexQuery);
    indexChecks.spatialIndexes = parseInt(indexResult.rows[0].spatial_indexes) >= 2;
  } catch (error) {
    errors.push('Could not verify spatial indexes');
  }

  // System metrics
  const systemMetrics = {
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  };

  // Environment checks
  const environmentChecks = {
    nodeEnv: process.env.NODE_ENV || 'development',
    requiredEnvVars: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      JWT_SECRET: !!process.env.JWT_SECRET,
      SMTP_HOST: !!process.env.SMTP_HOST,
      MAPBOX_ACCESS_TOKEN: !!process.env.MAPBOX_ACCESS_TOKEN
    }
  };

  const missingEnvVars = Object.entries(environmentChecks.requiredEnvVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingEnvVars.length > 0) {
    errors.push(`Missing environment variables: ${missingEnvVars.join(', ')}`);
    overallStatus = 'degraded';
  }

  const [seconds, nanoseconds] = process.hrtime(startTime);
  const responseTime = seconds * 1000 + nanoseconds / 1000000;

  const detailedHealth = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    responseTime: `${responseTime.toFixed(2)}ms`,
    version: process.env.npm_package_version || '1.0.0',
    database: databaseChecks,
    tables: tableChecks,
    indexes: indexChecks,
    system: systemMetrics,
    environment: environmentChecks,
    errors: errors.length > 0 ? errors : undefined
  };

  const statusCode = overallStatus === 'healthy' ? 200 : 
                    overallStatus === 'degraded' ? 200 : 503;

  res.status(statusCode).json(detailedHealth);
});

// GET /api/health/ready - Readiness probe for Kubernetes/Railway
router.get('/ready', async (req: Request, res: Response): Promise<void> => {
  try {
    // Quick database connectivity check
    await db.query('SELECT 1');
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/health/live - Liveness probe
router.get('/live', (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;