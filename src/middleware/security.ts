import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult, param, query } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Security headers middleware using Helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com"],
      scriptSrc: ["'self'", "https://api.mapbox.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.mapbox.com", "https://*.tiles.mapbox.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for map tiles
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Rate limiting configurations
 */
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Příliš mnoho požadavků, zkuste to později',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Příliš mnoho požadavků, zkuste to později',
          retryAfter: Math.round(windowMs / 1000)
        }
      });
    }
  });
};

// Different rate limits for different endpoints
export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Příliš mnoho pokusů o přihlášení, zkuste to za 15 minut'
);

export const apiRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100 // 100 requests per 15 minutes
);

export const uploadRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10 // 10 uploads per hour
);

export const conflictDetectionRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  20 // 20 conflict detections per 5 minutes
);

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize string fields in body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(obj, { 
      ALLOWED_TAGS: [], 
      ALLOWED_ATTR: [] 
    });
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validation schemas for common inputs
 */
export const validateProjectInput = [
  body('name')
    .isLength({ min: 1, max: 255 })
    .withMessage('Název projektu musí mít 1-255 znaků')
    .matches(/^[a-zA-ZÀ-ÿ0-9\s\-_.()]+$/)
    .withMessage('Název obsahuje nepovolené znaky'),
  
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Popis může mít maximálně 2000 znaků'),
  
  body('workType')
    .isIn(['excavation', 'road_work', 'utility_installation', 'maintenance', 'emergency'])
    .withMessage('Neplatný typ práce'),
  
  body('workCategory')
    .isIn(['major', 'minor', 'emergency', 'maintenance'])
    .withMessage('Neplatná kategorie práce'),
  
  body('startDate')
    .isISO8601()
    .withMessage('Neplatné datum začátku'),
  
  body('endDate')
    .isISO8601()
    .withMessage('Neplatné datum konce')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error('Datum konce musí být po datu začátku');
      }
      return true;
    }),
  
  body('geometry')
    .custom((geometry) => {
      if (!geometry || !geometry.type || !geometry.coordinates) {
        throw new Error('Neplatná geometrie');
      }
      
      const allowedTypes = ['Point', 'LineString', 'Polygon'];
      if (!allowedTypes.includes(geometry.type)) {
        throw new Error('Nepovolený typ geometrie');
      }
      
      return true;
    })
];

export const validateUserInput = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Neplatný email'),
  
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Jméno musí mít 2-100 znaků')
    .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/)
    .withMessage('Jméno obsahuje nepovolené znaky'),
  
  body('organization')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Organizace může mít maximálně 200 znaků'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Heslo musí mít 8-128 znaků')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Heslo musí obsahovat malé a velké písmeno, číslo a speciální znak')
];

export const validateCommentInput = [
  body('content')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Komentář musí mít 1-1000 znaků'),
  
  param('projectId')
    .isUUID()
    .withMessage('Neplatné ID projektu')
];

export const validateMoratoriumInput = [
  body('name')
    .isLength({ min: 1, max: 255 })
    .withMessage('Název moratoria musí mít 1-255 znaků'),
  
  body('reason')
    .isIn(['road_reconstruction', 'utility_work', 'special_event', 'environmental_protection', 'other'])
    .withMessage('Neplatný důvod moratoria'),
  
  body('validFrom')
    .isISO8601()
    .withMessage('Neplatné datum začátku'),
  
  body('validTo')
    .isISO8601()
    .withMessage('Neplatné datum konce')
    .custom((validTo, { req }) => {
      const startDate = new Date(req.body.validFrom);
      const endDate = new Date(validTo);
      const maxDuration = 5 * 365 * 24 * 60 * 60 * 1000; // 5 years
      
      if (endDate <= startDate) {
        throw new Error('Datum konce musí být po datu začátku');
      }
      
      if (endDate.getTime() - startDate.getTime() > maxDuration) {
        throw new Error('Moratorium nemůže trvat déle než 5 let');
      }
      
      return true;
    }),
  
  body('geometry')
    .custom((geometry) => {
      if (!geometry || !geometry.type || !geometry.coordinates) {
        throw new Error('Neplatná geometrie');
      }
      
      const allowedTypes = ['Polygon', 'MultiPolygon'];
      if (!allowedTypes.includes(geometry.type)) {
        throw new Error('Moratorium musí být polygon');
      }
      
      return true;
    })
];

/**
 * Validation error handler
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Neplatné vstupní data',
        details: errors.array().map(error => ({
          field: error.type === 'field' ? error.path : 'unknown',
          message: error.msg
        }))
      }
    });
    return;
  }

  next();
};

/**
 * SQL injection protection
 */
export const validateUUID = [
  param('id')
    .isUUID()
    .withMessage('Neplatné ID')
];

export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Stránka musí být číslo 1-1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit musí být číslo 1-100')
];

/**
 * File upload security
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return next();
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'Nepovolený typ souboru'
      }
    });
  }

  if (req.file.size > maxFileSize) {
    return res.status(400).json({
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'Soubor je příliš velký (max 10MB)'
      }
    });
  }

  // Check for malicious file names
  const dangerousPatterns = [
    /\.\./,
    /[<>:"|?*]/,
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
  ];

  if (dangerousPatterns.some(pattern => pattern.test(req.file!.originalname))) {
    return res.status(400).json({
      error: {
        code: 'INVALID_FILENAME',
        message: 'Neplatný název souboru'
      }
    });
  }

  next();
};

/**
 * CORS configuration
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173', // Vite dev server
      'https://digikop.railway.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // In test environment, allow all localhost origins
    if (process.env.NODE_ENV === 'test' && origin?.startsWith('http://localhost')) {
      callback(null, true);
      return;
    }

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Nepovolený původ požadavku'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

/**
 * Request logging for security monitoring
 */
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration,
      userId: (req as any).user?.id
    };

    // Log suspicious activity
    if (res.statusCode >= 400 || duration > 5000) {
      console.warn('Suspicious request:', logData);
    }
  });

  next();
};