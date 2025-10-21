-- DigiKop Initial Database Schema
-- This migration creates the core tables for the coordination system

-- Enable required extensions
-- Note: PostGIS is optional and handled by migration script
-- CREATE EXTENSION IF NOT EXISTS postgis;  -- Commented out - handled by TypeScript migration
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    role VARCHAR(50) NOT NULL CHECK (role IN ('regional_admin', 'municipal_coordinator', 'applicant')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User territorial permissions
CREATE TABLE IF NOT EXISTS user_territories (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    municipality_code VARCHAR(10) NOT NULL,
    municipality_name VARCHAR(255) NOT NULL,
    PRIMARY KEY (user_id, municipality_code)
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    applicant_id UUID REFERENCES users(id) NOT NULL,
    contractor_organization VARCHAR(255),
    contractor_contact JSONB, -- {name, phone, email}
    state VARCHAR(50) NOT NULL DEFAULT 'draft'
        CHECK (state IN ('draft', 'forward_planning', 'pending_approval', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    geometry TEXT NOT NULL, -- GeoJSON format when PostGIS unavailable, GEOMETRY(Geometry, 4326) when available
    work_type VARCHAR(100) NOT NULL,
    work_category VARCHAR(50) NOT NULL,
    description TEXT,
    has_conflict BOOLEAN DEFAULT FALSE,
    conflicting_project_ids UUID[],
    affected_municipalities TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Moratoriums table
CREATE TABLE IF NOT EXISTS moratoriums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    geometry TEXT NOT NULL, -- GeoJSON format when PostGIS unavailable, GEOMETRY(Geometry, 4326) when available
    reason VARCHAR(100) NOT NULL,
    reason_detail TEXT,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    exceptions TEXT,
    created_by UUID REFERENCES users(id) NOT NULL,
    municipality_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_moratorium_period CHECK (valid_to >= valid_from),
    CONSTRAINT max_moratorium_duration CHECK (valid_to <= valid_from + INTERVAL '5 years')
);

-- Project comments table
CREATE TABLE IF NOT EXISTS project_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) NOT NULL,
    content TEXT NOT NULL CHECK (length(content) <= 1000),
    attachment_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- 'project', 'user', 'moratorium'
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'state_change'
    user_id UUID REFERENCES users(id),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_user_territories_user ON user_territories(user_id);
CREATE INDEX idx_user_territories_municipality ON user_territories(municipality_code);

CREATE INDEX idx_projects_applicant ON projects(applicant_id);
CREATE INDEX idx_projects_state ON projects(state);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);
-- CREATE INDEX idx_projects_geometry ON projects USING GIST(geometry);  -- PostGIS only - created by migration script if available
CREATE INDEX idx_projects_conflict ON projects(has_conflict);
CREATE INDEX idx_projects_municipalities ON projects USING GIN(affected_municipalities);

CREATE INDEX idx_moratoriums_creator ON moratoriums(created_by);
CREATE INDEX idx_moratoriums_municipality ON moratoriums(municipality_code);
CREATE INDEX idx_moratoriums_dates ON moratoriums(valid_from, valid_to);
-- CREATE INDEX idx_moratoriums_geometry ON moratoriums USING GIST(geometry);  -- PostGIS only - created by migration script if available

CREATE INDEX idx_comments_project ON project_comments(project_id);
CREATE INDEX idx_comments_user ON project_comments(user_id);
CREATE INDEX idx_comments_created ON project_comments(created_at);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();