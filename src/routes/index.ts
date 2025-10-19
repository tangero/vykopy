import { Router } from 'express';
import { Request, Response } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import territoryRoutes from './territories';

const router = Router();

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
    },
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/territories', territoryRoutes);

export default router;