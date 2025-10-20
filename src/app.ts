import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { config } from './config';
import { 
  requestId, 
  errorHandler, 
  notFound, 
  rateLimiter, 
  apiRateLimiter,
  corsOptions 
} from './middleware';
import routes, { initializeRoutes } from './routes';
import { pool } from './config/database';
import { notificationTriggers } from './services/NotificationTriggers';
import { emailService } from './services/EmailService';

// Create Express application
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com"],
      scriptSrc: ["'self'", "https://api.mapbox.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.mapbox.com", "https://*.tiles.mapbox.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      workerSrc: ["'self'", "blob:"],
    },
  },
}));

// CORS configuration
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Request logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// Rate limiting
app.use(rateLimiter);

// Request ID middleware
app.use(requestId);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize routes with database connection
initializeRoutes(pool);

// Initialize notification system
if (config.nodeEnv !== 'test') {
  // Verify email connection
  emailService.verifyConnection().then(isConnected => {
    if (isConnected) {
      // Initialize notification triggers and schedulers
      notificationTriggers.initialize();
    } else {
      console.warn('⚠️ Email service not available - notifications will be queued but not sent');
    }
  });
}

// API routes with additional rate limiting
app.use(config.api.prefix, apiRateLimiter, routes);

// 404 handler
app.use(notFound);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;