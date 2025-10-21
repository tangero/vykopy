import { Router } from 'express';
import { Request, Response } from 'express';
import { Pool } from 'pg';
import authRoutes from './auth';
import userRoutes from './users';
import territoryRoutes from './territories';
import projectRoutes, { initializeProjectRoutes } from './projects';
import moratoriumRoutes, { initializeMoratoriumRoutes } from './moratoriums';
import spatialRoutes, { initializeSpatialRoutes } from './spatial';
import fileRoutes from './files';
import auditRoutes from './audit';
import healthRoutes, { initializeHealthRoutes } from './health';

const router = Router();

// Initialize routes with database connection
export const initializeRoutes = (db: Pool): void => {
  initializeProjectRoutes(db);
  initializeMoratoriumRoutes(db);
  initializeSpatialRoutes(db);
  initializeHealthRoutes(db);
};

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// API info endpoint
router.get('/info', (req: Request, res: Response) => {
  res.json({
    name: 'DigiKop Coordination System API',
    version: '1.0.0',
    description: 'Web-based coordination platform for excavation works in Central Bohemian Region',
    endpoints: {
      health: '/api/health',
      info: '/api/info',
      auth: '/api/auth',
      users: '/api/users',
      territories: '/api/territories',
      projects: '/api/projects',
      moratoriums: '/api/moratoriums',
      spatial: '/api/spatial',
      files: '/api/files',
      audit: '/api/audit',
    },
  });
});

// Mount route modules
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/territories', territoryRoutes);
router.use('/projects', projectRoutes);
router.use('/moratoriums', moratoriumRoutes);
router.use('/spatial', spatialRoutes);
router.use('/files', fileRoutes);
router.use('/audit', auditRoutes);

export default router;