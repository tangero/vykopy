import { config } from './index';

export const securityConfig = {
  // JWT Configuration
  jwt: {
    secret: config.jwt.secret,
    expiresIn: config.jwt.expiresIn,
    algorithm: 'HS256' as const,
    issuer: 'digikop-api',
    audience: 'digikop-client'
  },

  // Password Requirements
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '@$!%*?&',
    maxAttempts: 5,
    lockoutDuration: 15 * 60 * 1000 // 15 minutes
  },

  // Rate Limiting
  rateLimit: {
    // General API rate limit
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // requests per window
    },
    
    // Authentication endpoints
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5 // login attempts per window
    },
    
    // File upload endpoints
    upload: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10 // uploads per window
    },
    
    // Conflict detection (expensive operations)
    conflictDetection: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 20 // detections per window
    },
    
    // Project creation
    projectCreation: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 50 // projects per hour
    }
  },

  // File Upload Security
  fileUpload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.doc', '.docx'],
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    virusScanEnabled: process.env.VIRUS_SCAN_ENABLED === 'true'
  },

  // Input Validation
  validation: {
    maxStringLength: 2000,
    maxArrayLength: 100,
    maxObjectDepth: 5,
    allowedHtmlTags: [], // No HTML allowed by default
    allowedHtmlAttributes: []
  },

  // Session Security
  session: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },

  // CORS Configuration
  cors: {
    origin: config.nodeEnv === 'production' 
      ? [process.env.FRONTEND_URL, 'https://digikop.railway.app'].filter(Boolean)
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
  },

  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "https://api.mapbox.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.mapbox.com", "https://*.tiles.mapbox.com", "wss://api.mapbox.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://api.mapbox.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"]
    },
    reportOnly: config.nodeEnv !== 'production'
  },

  // Security Headers
  headers: {
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: 'strict-origin-when-cross-origin'
  },

  // Audit and Logging
  audit: {
    logFailedLogins: true,
    logSuspiciousActivity: true,
    logDataChanges: true,
    retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
    anonymizeAfter: 30 * 24 * 60 * 60 * 1000 // 30 days
  },

  // Database Security
  database: {
    ssl: config.nodeEnv === 'production',
    connectionTimeout: 30000,
    queryTimeout: 30000,
    maxConnections: 20,
    idleTimeout: 30000
  },

  // API Security
  api: {
    trustProxy: config.nodeEnv === 'production',
    hidePoweredBy: true,
    etag: false,
    requestSizeLimit: '10mb',
    parameterLimit: 100,
    jsonLimit: '10mb',
    urlencodedLimit: '10mb'
  }
};

// Environment-specific overrides
if (config.nodeEnv === 'development') {
  // Relax some restrictions for development
  securityConfig.csp.directives.scriptSrc.push("'unsafe-eval'");
  securityConfig.headers.hsts.maxAge = 0;
}

if (config.nodeEnv === 'test') {
  // Disable rate limiting for tests
  Object.keys(securityConfig.rateLimit).forEach(key => {
    (securityConfig.rateLimit as any)[key].max = 1000;
  });
}

export default securityConfig;