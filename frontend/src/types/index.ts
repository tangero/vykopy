import type { Geometry } from 'geojson';

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId: string;
  };
}

export interface Project {
  id: string;
  name: string;
  applicant_id: string;
  contractor_organization?: string;
  contractor_contact?: {
    name: string;
    phone: string;
    email: string;
  };
  state:
    | 'draft'
    | 'forward_planning'
    | 'pending_approval'
    | 'approved'
    | 'in_progress'
    | 'completed'
    | 'rejected'
    | 'cancelled';
  start_date: string;
  end_date: string;
  geometry: Geometry;
  work_type: string;
  work_category: string;
  description?: string;
  has_conflict: boolean;
  conflicting_project_ids: string[];
  affected_municipalities: string[];
  created_at: string;
  updated_at: string;
}

export interface Moratorium {
  id: string;
  name: string;
  geometry: Geometry;
  reason: string;
  reason_detail?: string;
  valid_from: string;
  valid_to: string;
  exceptions?: string;
  created_by: string;
  municipality_code: string;
  created_at: string;
}
