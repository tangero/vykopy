// Mock server for testing without database
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import mockAuthRoutes from './routes/mockAuth';

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '1.0.0'
  });
});

// Mock API routes
app.use('/api/auth', mockAuthRoutes);

// Mock projects endpoint
app.get('/api/projects', (req, res) => {
  res.json({
    success: true,
    data: {
      projects: [
        {
          id: '1',
          name: 'Rekonstrukce vodovodu - Hlavní ulice',
          applicant: 'Vodárny Středních Čech',
          state: 'pending_approval',
          geometry: {
            type: 'LineString',
            coordinates: [[14.4378, 50.0755], [14.4398, 50.0765]]
          }
        }
      ]
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: config.nodeEnv === 'development' ? error.message : 'Internal server error',
    ...(config.nodeEnv === 'development' && { stack: error.stack })
  });
});

// Start server
const startMockServer = (): void => {
  const server = app.listen(config.port, () => {
    console.log(`🚀 DigiKop MOCK server running on port ${config.port}`);
    console.log(`📍 Environment: ${config.nodeEnv}`);
    console.log(`🔗 API endpoint: http://localhost:${config.port}/api`);
    console.log('⚠️  Using MOCK authentication - no database required');
  });

  // Graceful shutdown
  const gracefulShutdown = (signal: string): void => {
    console.log(`\n📡 Received ${signal}, starting graceful shutdown...`);
    server.close(() => {
      console.log('✅ Mock server shutdown completed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startMockServer();