import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/User';
import { UserRole } from '../types';

// Enhanced RBAC middleware with territorial permissions
export class RBACMiddleware {
  // Check if user has required role
  static requireRole(allowedRoles: UserRole[]) {
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
            message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
        return;
      }

      next();
    };
  }

  // Check territorial access for municipal coordinators
  static requireTerritorialAccess(getMunicipalityCode?: (req: Request) => string | string[] | Promise<string | string[]>) {
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
        if (getMunicipalityCode) {
          try {
            const municipalityCodes = await getMunicipalityCode(req);
            const codes = Array.isArray(municipalityCodes) ? municipalityCodes : [municipalityCodes];
            
            // Check access for each municipality code
            for (const code of codes) {
              const hasAccess = await UserModel.hasAccessToMunicipality(req.user.id, code);
              if (!hasAccess) {
                res.status(403).json({
                  error: {
                    code: 'TERRITORIAL_ACCESS_DENIED',
                    message: `Access denied for municipality: ${code}`,
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                  },
                });
                return;
              }
            }
          } catch (error) {
            res.status(500).json({
              error: {
                code: 'TERRITORIAL_CHECK_FAILED',
                message: 'Failed to verify territorial access',
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

      // Applicants can access their own resources (ownership check in route handlers)
      if (req.user.role === 'applicant') {
        next();
        return;
      }

      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    };
  }

  // Check resource ownership for applicants
  static requireOwnership(getResourceOwnerId: (req: Request) => string | Promise<string>) {
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

      // Regional admins and municipal coordinators can access any resource
      if (req.user.role === 'regional_admin' || req.user.role === 'municipal_coordinator') {
        next();
        return;
      }

      // Applicants can only access their own resources
      if (req.user.role === 'applicant') {
        try {
          const resourceOwnerId = await getResourceOwnerId(req);
          
          if (resourceOwnerId !== req.user.id) {
            res.status(403).json({
              error: {
                code: 'OWNERSHIP_REQUIRED',
                message: 'You can only access your own resources',
                timestamp: new Date().toISOString(),
                requestId: req.requestId,
              },
            });
            return;
          }
        } catch (error) {
          res.status(500).json({
            error: {
              code: 'OWNERSHIP_CHECK_FAILED',
              message: 'Failed to verify resource ownership',
              timestamp: new Date().toISOString(),
              requestId: req.requestId,
            },
          });
          return;
        }
      }

      next();
    };
  }

  // Combined middleware for territorial access and ownership
  static requireTerritorialAccessOrOwnership(
    getMunicipalityCode: (req: Request) => string | string[] | Promise<string | string[]>,
    getResourceOwnerId: (req: Request) => string | Promise<string>
  ) {
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
        try {
          const municipalityCodes = await getMunicipalityCode(req);
          const codes = Array.isArray(municipalityCodes) ? municipalityCodes : [municipalityCodes];
          
          // Check access for each municipality code
          for (const code of codes) {
            const hasAccess = await UserModel.hasAccessToMunicipality(req.user.id, code);
            if (!hasAccess) {
              res.status(403).json({
                error: {
                  code: 'TERRITORIAL_ACCESS_DENIED',
                  message: `Access denied for municipality: ${code}`,
                  timestamp: new Date().toISOString(),
                  requestId: req.requestId,
                },
              });
              return;
            }
          }
          next();
          return;
        } catch (error) {
          res.status(500).json({
            error: {
              code: 'TERRITORIAL_CHECK_FAILED',
              message: 'Failed to verify territorial access',
              timestamp: new Date().toISOString(),
              requestId: req.requestId,
            },
          });
          return;
        }
      }

      // Applicants can only access their own resources
      if (req.user.role === 'applicant') {
        try {
          const resourceOwnerId = await getResourceOwnerId(req);
          
          if (resourceOwnerId !== req.user.id) {
            res.status(403).json({
              error: {
                code: 'OWNERSHIP_REQUIRED',
                message: 'You can only access your own resources',
                timestamp: new Date().toISOString(),
                requestId: req.requestId,
              },
            });
            return;
          }
          next();
          return;
        } catch (error) {
          res.status(500).json({
            error: {
              code: 'OWNERSHIP_CHECK_FAILED',
              message: 'Failed to verify resource ownership',
              timestamp: new Date().toISOString(),
              requestId: req.requestId,
            },
          });
          return;
        }
      }

      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    };
  }
}

// Utility functions for common access patterns
export class AccessUtils {
  // Get municipality codes from project geometry (placeholder - would use PostGIS in real implementation)
  static async getMunicipalityCodesFromGeometry(geometry: any): Promise<string[]> {
    // This would typically query a municipalities table with PostGIS
    // For now, return a placeholder
    return ['CZ0201']; // Example municipality code
  }

  // Get municipality codes from project ID
  static async getMunicipalityCodesFromProjectId(projectId: string): Promise<string[]> {
    // This would query the projects table and extract affected_municipalities
    // For now, return a placeholder
    return ['CZ0201']; // Example municipality code
  }

  // Check if user can perform action on project
  static async canAccessProject(userId: string, projectId: string, userRole: UserRole): Promise<boolean> {
    if (userRole === 'regional_admin') {
      return true;
    }

    if (userRole === 'municipal_coordinator') {
      const municipalityCodes = await this.getMunicipalityCodesFromProjectId(projectId);
      for (const code of municipalityCodes) {
        const hasAccess = await UserModel.hasAccessToMunicipality(userId, code);
        if (!hasAccess) {
          return false;
        }
      }
      return true;
    }

    if (userRole === 'applicant') {
      // Check if user owns the project (would query projects table)
      // For now, return false as placeholder
      return false;
    }

    return false;
  }

  // Filter projects based on user permissions
  static buildTerritorialFilter(userId: string, userRole: UserRole): string {
    if (userRole === 'regional_admin') {
      return ''; // No filter needed
    }

    if (userRole === 'municipal_coordinator') {
      return `
        AND EXISTS (
          SELECT 1 FROM user_territories ut 
          WHERE ut.user_id = '${userId}' 
          AND ut.municipality_code = ANY(projects.affected_municipalities)
        )
      `;
    }

    if (userRole === 'applicant') {
      return `AND projects.applicant_id = '${userId}'`;
    }

    return 'AND FALSE'; // Deny access by default
  }
}

// Export commonly used middleware combinations
export const requireRegionalAdmin = RBACMiddleware.requireRole(['regional_admin']);
export const requireCoordinatorOrAdmin = RBACMiddleware.requireRole(['regional_admin', 'municipal_coordinator']);
export const requireAnyRole = RBACMiddleware.requireRole(['regional_admin', 'municipal_coordinator', 'applicant']);