# Design Document

## Overview

DigiKop is a web-based coordination platform built as a modern single-page application with a map-centric interface. The system follows a three-tier architecture with a React frontend, Node.js/Express backend, and PostgreSQL database with PostGIS extensions for spatial data handling. The design emphasizes user experience through intuitive map interactions, real-time conflict detection, and streamlined approval workflows.

## Architecture

### System Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[React SPA] --> B[Map Interface - Mapbox GL JS]
        A --> C[State Management - Redux Toolkit]
        A --> D[Forms - React Hook Form]
    end
    
    subgraph "Backend Layer"
        E[Express.js API] --> F[Authentication Middleware]
        E --> G[RBAC Authorization]
        E --> H[Conflict Detection Engine]
        E --> I[Notification Service]
    end
    
    subgraph "Data Layer"
        J[(PostgreSQL + PostGIS)] --> K[Projects Table]
        J --> L[Users & Permissions]
        J --> M[Moratoriums]
        J --> N[Audit Logs]
    end
    
    subgraph "External Services"
        O[Email Service - SendGrid]
        P[File Storage - AWS S3]
        Q[Map Tiles - Mapbox/OSM]
    end
    
    A --> E
    E --> J
    I --> O
    E --> P
    B --> Q
```

### Data Flow Architecture

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant D as Database
    participant N as Notification Service
    
    U->>F: Submit Project
    F->>A: POST /api/projects
    A->>D: Save Project (Draft)
    A->>A: Run Conflict Detection
    A->>D: Update Conflict Status
    A->>N: Queue Notification
    N->>N: Send Email
    A->>F: Return Project + Conflicts
    F->>U: Show Confirmation + Warnings
```

## Components and Interfaces

### Frontend Components

#### Core Layout Components
- **AppLayout**: Main application shell with navigation and user context
- **MapContainer**: Primary map interface with project visualization
- **Sidebar**: Contextual panels for project details, forms, and filters
- **Navigation**: Top navigation bar with user menu and main sections

#### Map Components
- **ProjectLayer**: Renders projects as geometric features with state-based styling
- **MoratoriumLayer**: Displays restricted areas with red hatching
- **DrawingTools**: Interactive tools for creating project geometries
- **ConflictOverlay**: Highlights spatial conflicts with warning indicators
- **LayerControls**: Toggle switches for different map layers

#### Form Components
- **ProjectForm**: Multi-step wizard for project registration
  - Step 1: Basic information (name, applicant, contractor)
  - Step 2: Location drawing on map
  - Step 3: Timeline and categorization
- **MoratoriumForm**: Simple form for creating area restrictions
- **CommentForm**: Text input with file attachment support

#### Data Display Components
- **ProjectList**: Tabular view with filtering and sorting
- **ProjectDetail**: Comprehensive project information panel
- **ConflictAlert**: Warning component showing detected conflicts
- **NotificationCenter**: In-app notification display
- **AuditTrail**: Timeline of project changes and comments

### Backend API Endpoints

#### Authentication & Users
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/reset-password

GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
PUT    /api/users/:id/territories
```

#### Projects
```
GET    /api/projects              # List with filters
POST   /api/projects              # Create new
GET    /api/projects/:id          # Get details
PUT    /api/projects/:id          # Update
DELETE /api/projects/:id          # Delete
PUT    /api/projects/:id/status   # Change workflow state
POST   /api/projects/:id/comments # Add comment
GET    /api/projects/:id/conflicts # Get conflict analysis
```

#### Moratoriums
```
GET    /api/moratoriums
POST   /api/moratoriums
PUT    /api/moratoriums/:id
DELETE /api/moratoriums/:id
GET    /api/moratoriums/active    # Currently active restrictions
```

#### Spatial Operations
```
POST   /api/spatial/conflicts     # Detect conflicts for geometry
GET    /api/spatial/municipalities # Get affected municipalities
POST   /api/spatial/buffer        # Create buffer around geometry
```

### Database Schema

#### Core Tables
```sql
-- Users and Authentication
CREATE TABLE users (
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

-- Territorial Permissions
CREATE TABLE user_territories (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    municipality_code VARCHAR(10) NOT NULL,
    municipality_name VARCHAR(255) NOT NULL,
    PRIMARY KEY (user_id, municipality_code)
);

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    applicant_id UUID REFERENCES users(id) NOT NULL,
    contractor_organization VARCHAR(255),
    contractor_contact JSONB, -- {name, phone, email}
    state VARCHAR(50) NOT NULL DEFAULT 'draft' 
        CHECK (state IN ('draft', 'forward_planning', 'pending_approval', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    geometry GEOMETRY(Geometry, 4326) NOT NULL,
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

-- Moratoriums
CREATE TABLE moratoriums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    geometry GEOMETRY(Geometry, 4326) NOT NULL,
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

-- Comments and Communication
CREATE TABLE project_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) NOT NULL,
    content TEXT NOT NULL CHECK (length(content) <= 1000),
    attachment_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Trail
CREATE TABLE audit_logs (
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

-- Spatial Indexes
CREATE INDEX idx_projects_geometry ON projects USING GIST(geometry);
CREATE INDEX idx_projects_state ON projects(state);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);
CREATE INDEX idx_moratoriums_geometry ON moratoriums USING GIST(geometry);
CREATE INDEX idx_moratoriums_dates ON moratoriums(valid_from, valid_to);
```

## Data Models

### Project Workflow States

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> ForwardPlanning : 6+ months ahead
    Draft --> PendingApproval : Submit for approval
    ForwardPlanning --> PendingApproval : Date approaches
    PendingApproval --> Approved : Coordinator approves
    PendingApproval --> Rejected : Coordinator rejects
    Approved --> InProgress : Applicant starts work
    Approved --> Cancelled : Applicant cancels
    InProgress --> Completed : Work finished
    Rejected --> [*]
    Cancelled --> [*]
    Completed --> [*]
```

### Conflict Detection Algorithm

```typescript
interface ConflictDetectionResult {
  hasConflict: boolean;
  spatialConflicts: Project[];
  temporalConflicts: Project[];
  moratoriumViolations: Moratorium[];
}

async function detectConflicts(project: Project): Promise<ConflictDetectionResult> {
  // Spatial conflict detection with 20m buffer
  const spatialQuery = `
    SELECT p.* FROM projects p 
    WHERE p.state IN ('approved', 'in_progress')
    AND ST_DWithin(p.geometry, ST_Buffer($1, 20), 0)
    AND p.id != $2
  `;
  
  // Temporal overlap check
  const temporalQuery = `
    AND (
      (p.start_date <= $3 AND p.end_date >= $3) OR
      (p.start_date <= $4 AND p.end_date >= $4) OR
      (p.start_date >= $3 AND p.end_date <= $4)
    )
  `;
  
  // Moratorium violation check
  const moratoriumQuery = `
    SELECT m.* FROM moratoriums m
    WHERE m.valid_from <= $3 AND m.valid_to >= $3
    AND ST_Intersects(m.geometry, $1)
  `;
  
  // Execute queries and return results
}
```

## Error Handling

### Frontend Error Handling
- **Network Errors**: Retry mechanism with exponential backoff
- **Validation Errors**: Real-time form validation with clear error messages
- **Authentication Errors**: Automatic redirect to login with session restoration
- **Map Errors**: Fallback to alternative tile sources
- **File Upload Errors**: Progress indication and retry options

### Backend Error Handling
- **Database Errors**: Connection pooling with automatic reconnection
- **Spatial Query Errors**: Geometry validation and simplification
- **Email Delivery Errors**: Queue-based retry system with dead letter handling
- **File Storage Errors**: Multiple storage backend support
- **Rate Limiting**: Graceful degradation with informative responses

### Error Response Format
```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  }
}
```

## Testing Strategy

### Unit Testing
- **Frontend**: Jest + React Testing Library for component testing
- **Backend**: Jest + Supertest for API endpoint testing
- **Database**: Separate test database with transaction rollback
- **Spatial Functions**: PostGIS-specific test cases for geometric operations

### Integration Testing
- **API Integration**: Full request/response cycle testing
- **Database Integration**: Real database operations with test data
- **Email Integration**: Mock email service for notification testing
- **Map Integration**: Headless browser testing for map interactions

### End-to-End Testing
- **User Workflows**: Playwright for complete user journey testing
- **Cross-browser**: Chrome, Firefox, Safari compatibility
- **Mobile Responsive**: Touch interaction and responsive layout testing
- **Performance**: Load testing for map rendering and spatial queries

### Test Data Strategy
- **Synthetic Data**: Generated test projects and users
- **Geographic Data**: Real municipality boundaries for Czech Republic
- **Conflict Scenarios**: Predefined overlapping projects for testing
- **Edge Cases**: Invalid geometries, extreme date ranges, large datasets

## Security Considerations

### Authentication & Authorization
- **JWT Tokens**: Short-lived access tokens with refresh token rotation
- **Password Security**: bcrypt hashing with salt rounds of 12
- **Session Management**: Redis-based session storage with TTL
- **Role-Based Access**: Middleware enforcement of geographic boundaries

### Data Protection
- **Input Validation**: Zod schemas for all API inputs
- **SQL Injection**: Parameterized queries through ORM
- **XSS Protection**: React's built-in escaping + Content Security Policy
- **File Upload Security**: MIME type validation, virus scanning, size limits

### Infrastructure Security
- **HTTPS Enforcement**: TLS 1.3 with HSTS headers
- **CORS Configuration**: Restricted to frontend domain
- **Rate Limiting**: Per-IP and per-user request throttling
- **Database Security**: Connection encryption, restricted user permissions

### Privacy & GDPR Compliance
- **Data Minimization**: Only collect necessary project information
- **Consent Management**: Clear privacy policy and consent tracking
- **Right to Deletion**: Admin interface for user data removal
- **Data Export**: JSON export of user's own data
- **Audit Logging**: IP anonymization after 90 days

## Deployment & Infrastructure

### Railway.com Hosting Configuration

**Services Setup:**
```yaml
# railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start:prod",
    "healthcheckPath": "/api/health"
  }
}
```

**Database Configuration:**
- **PostgreSQL 15** with PostGIS 3.4 extension
- Automatic backups and point-in-time recovery
- Connection pooling with PgBouncer
- Environment variables for connection strings

**Environment Variables:**
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db
POSTGRES_DB=digikop_prod

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# Email Service
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-key

# File Storage
UPLOAD_PATH=/app/uploads
MAX_FILE_SIZE=10485760

# Map Services
MAPBOX_ACCESS_TOKEN=your-mapbox-token
```

**Deployment Strategy:**
- **Automatic deploys** from GitHub main branch
- **Preview deployments** for pull requests
- **Zero-downtime deployments** with health checks
- **Horizontal scaling** based on CPU/memory usage

**Monitoring & Logging:**
- Built-in Railway metrics dashboard
- Application logs with structured JSON format
- Error tracking with Sentry integration
- Uptime monitoring with Railway's built-in checks

**Cost Estimation:**
- **Starter Plan**: $5/month (suitable for development)
- **Pro Plan**: $20/month (recommended for production)
- **Database**: $10-25/month depending on size
- **Total MVP cost**: ~$30-50/month