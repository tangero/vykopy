import { z } from 'zod';

// User validation schemas
export const userRoleSchema = z.enum(['regional_admin', 'municipal_coordinator', 'applicant']);

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  organization: z.string().max(255).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  organization: z.string().max(255).optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
});

// Project validation schemas
export const projectStateSchema = z.enum([
  'draft',
  'forward_planning', 
  'pending_approval',
  'approved',
  'in_progress',
  'completed',
  'rejected',
  'cancelled'
]);

export const contactInfoSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
});

export const geoJsonGeometrySchema = z.object({
  type: z.enum(['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon']),
  coordinates: z.array(z.any()), // More specific validation would be complex
});

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  contractorOrganization: z.string().max(255).optional(),
  contractorContact: contactInfoSchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  geometry: geoJsonGeometrySchema,
  workType: z.string().min(1).max(100),
  workCategory: z.string().min(1).max(50),
  description: z.string().max(2000).optional(),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
);

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  contractorOrganization: z.string().max(255).optional(),
  contractorContact: contactInfoSchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  geometry: geoJsonGeometrySchema.optional(),
  workType: z.string().min(1).max(100).optional(),
  workCategory: z.string().min(1).max(50).optional(),
  description: z.string().max(2000).optional(),
  state: projectStateSchema.optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  },
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
);

// Moratorium validation schemas
export const createMoratoriumSchema = z.object({
  name: z.string().min(1).max(255),
  geometry: geoJsonGeometrySchema,
  reason: z.string().min(1).max(100),
  reasonDetail: z.string().max(1000).optional(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  exceptions: z.string().max(1000).optional(),
  municipalityCode: z.string().min(1).max(10),
}).refine(
  (data) => {
    const validFrom = new Date(data.validFrom);
    const validTo = new Date(data.validTo);
    const maxDuration = new Date(validFrom);
    maxDuration.setFullYear(maxDuration.getFullYear() + 5);
    
    return validTo >= validFrom && validTo <= maxDuration;
  },
  {
    message: 'Moratorium duration cannot exceed 5 years and end date must be after start date',
    path: ['validTo'],
  }
);

// Comment validation schemas
export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(1000),
  attachmentUrl: z.string().url().optional(),
});

// Query parameter schemas
export const projectQuerySchema = z.object({
  state: projectStateSchema.optional(),
  municipality: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  workCategory: z.string().optional(),
  hasConflict: z.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// Spatial operation schemas
export const conflictDetectionSchema = z.object({
  geometry: geoJsonGeometrySchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  excludeProjectId: z.string().uuid().optional(),
});

export const municipalityDetectionSchema = z.object({
  geometry: geoJsonGeometrySchema,
});

// Territory assignment schema
export const assignTerritorySchema = z.object({
  municipalityCode: z.string().min(1).max(10),
  municipalityName: z.string().min(1).max(255),
});

export const assignTerritoriesSchema = z.object({
  territories: z.array(assignTerritorySchema),
});