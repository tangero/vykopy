import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload, User, UserRole } from '../types';
import { UserModel } from '../models/User';

// Middleware to verify JWT token
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    
    // Fetch current user from database
    const user = await UserModel.findById(decoded.userId);
    
    if (!user) {
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found or inactive',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
};

// Middleware to check user roles
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this action',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    next();
  };
};

// Middleware to check territorial permissions
export const requireTerritorialAccess = (municipalityCode?: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Regional admins have access to everything
    if (req.user.role === 'regional_admin') {
      next();
      return;
    }

    // Municipal coordinators need territorial validation
    if (req.user.role === 'municipal_coordinator') {
      if (municipalityCode) {
        const hasAccess = await UserModel.hasAccessToMunicipality(req.user.id, municipalityCode);
        if (!hasAccess) {
          res.status(403).json({
            error: {
              code: 'TERRITORIAL_ACCESS_DENIED',
              message: 'Access denied for this territory',
              timestamp: new Date().toISOString(),
              requestId: req.requestId,
            },
          });
          return;
        }
      }
      next();
      return;
    }

    // Applicants can only access their own projects
    if (req.user.role === 'applicant') {
      // Ownership check will be handled in individual route handlers
      next();
      return;
    }

    res.status(403).json({
      error: {
        code: 'TERRITORIAL_ACCESS_DENIED',
        message: 'Access denied for this territory',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  };
};