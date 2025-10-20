// Core data model interfaces for DigiKop system

export interface User {
  id: string;
  email: string;
  name: string;
  organization?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'regional_admin' | 'municipal_coordinator' | 'applicant';

export interface UserTerritory {
  userId: string;
  municipalityCode: string;
  municipalityName: string;
}

export interface Project {
  id: string;
  name: string;
  applicantId: string;
  contractorOrganization?: string;
  contractorContact?: ContactInfo;
  state: ProjectState;
  startDate: Date;
  endDate: Date;
  geometry: GeoJSON.Geometry;
  workType: string;
  workCategory: string;
  description?: string;
  hasConflict: boolean;
  conflictingProjectIds: string[];
  affectedMunicipalities: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectState = 
  | 'draft' 
  | 'forward_planning' 
  | 'pending_approval' 
  | 'approved' 
  | 'in_progress' 
  | 'completed' 
  | 'rejected' 
  | 'cancelled';

export interface ContactInfo {
  name: string;
  phone?: string;
  email?: string;
}

export interface Moratorium {
  id: string;
  name: string;
  geometry: GeoJSON.Geometry;
  reason: string;
  reasonDetail?: string;
  validFrom: Date;
  validTo: Date;
  exceptions?: string;
  createdBy: string;
  municipalityCode: string;
  createdAt: Date;
}

export interface ProjectComment {
  id: string;
  projectId: string;
  userId: string;
  content: string;
  attachmentUrl?: string;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  entityType: 'project' | 'user' | 'moratorium';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'state_change';
  userId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

export interface ConflictDetectionResult {
  hasConflict: boolean;
  spatialConflicts: Project[];
  temporalConflicts: Project[];
  moratoriumViolations: Moratorium[];
}

// API Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'password'>;
  token: string;
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  organization?: string;
}

export interface CreateProjectRequest {
  name: string;
  contractorOrganization?: string;
  contractorContact?: ContactInfo;
  startDate: string;
  endDate: string;
  geometry: GeoJSON.Geometry;
  workType: string;
  workCategory: string;
  description?: string;
}

export interface UpdateProjectRequest extends Partial<CreateProjectRequest> {
  state?: ProjectState;
}

export interface CreateMoratoriumRequest {
  name: string;
  geometry: GeoJSON.Geometry;
  reason: string;
  reasonDetail?: string;
  validFrom: string;
  validTo: string;
  exceptions?: string;
  municipalityCode: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}

// Database connection types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// JWT payload interface
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// Notification types
export interface NotificationPreferences {
  emailEnabled: boolean;
  projectUpdates: boolean;
  conflictAlerts: boolean;
  deadlineReminders: boolean;
  commentNotifications: boolean;
}

export interface NotificationLog {
  id: string;
  userId: string;
  type: string;
  entityType: string;
  entityId: string;
  sent: boolean;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
}

// Express request extensions
declare global {
  namespace Express {
    interface Request {
      user?: User;
      requestId?: string;
    }
  }
}