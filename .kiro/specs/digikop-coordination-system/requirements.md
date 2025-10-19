# Requirements Document

## Introduction

DigiKop is a web-based service for digital coordination of excavation works and road interventions in the Central Bohemian Region. The system modernizes the process of registering, approving, and monitoring excavations, inspired by the British EToN (Electronic Transfer of Notifications) system but adapted to the Czech environment and legal framework. The MVP aims to create a user-friendly and efficient central platform that minimizes excavation conflicts by 50%, accelerates approval processes from weeks to 48 hours, and increases transparency between municipalities, network operators, and contractors.

## Glossary

- **DigiKop_System**: The web-based coordination platform for excavation works
- **Regional_Administrator**: User with full access to the entire Central Bohemian Region
- **Municipal_Coordinator**: User with access limited to their assigned municipality/ORP territory
- **Applicant**: User who can register excavation projects and view only their own projects
- **Excavation_Project**: A registered work activity involving ground excavation or road intervention
- **Conflict_Detection**: Automated system checking for spatial and temporal overlaps between projects
- **Moratorium**: Temporary restriction on excavation works in a specific area
- **ORP**: Municipality with Extended Competence (Obec s Rozšířenou Působností)
- **Workflow_State**: Current status of a project in the approval and execution process
- **Buffer_Zone**: 20-meter radius around excavation geometry for conflict detection
- **Notification_System**: Automated email alerts for project status changes and events

## Requirements

### Requirement 1

**User Story:** As a Regional Administrator, I want to manage user accounts and assign territorial permissions, so that I can control access to the system and ensure proper geographic boundaries.

#### Acceptance Criteria

1. WHEN a new user registers, THE DigiKop_System SHALL send a notification to the Regional_Administrator for approval
2. THE DigiKop_System SHALL allow the Regional_Administrator to assign specific municipalities or ORPs to Municipal_Coordinators through a visual map interface
3. THE DigiKop_System SHALL enforce geographic access restrictions where Municipal_Coordinators can only view and manage projects within their assigned territories
4. THE DigiKop_System SHALL provide the Regional_Administrator with full read and write access to all projects across the Central Bohemian Region
5. WHEN the Regional_Administrator assigns territories, THE DigiKop_System SHALL automatically update user permissions within 5 seconds

### Requirement 2

**User Story:** As a Municipal Coordinator, I want to review and approve excavation requests in my territory, so that I can prevent conflicts and coordinate infrastructure works effectively.

#### Acceptance Criteria

1. WHEN an Excavation_Project is submitted for approval in the Municipal_Coordinator's territory, THE DigiKop_System SHALL send an email notification within 2 minutes
2. THE DigiKop_System SHALL display only projects within the Municipal_Coordinator's assigned geographic boundaries
3. WHEN reviewing a project, THE DigiKop_System SHALL show any detected conflicts with existing approved or in-progress projects
4. THE DigiKop_System SHALL allow the Municipal_Coordinator to approve, reject, or request modifications to pending projects
5. WHEN a Municipal_Coordinator takes action on a project, THE DigiKop_System SHALL update the project status and notify the Applicant within 5 minutes

### Requirement 3

**User Story:** As an Applicant, I want to register excavation projects with location and timing details, so that I can obtain official approval for my planned works.

#### Acceptance Criteria

1. THE DigiKop_System SHALL provide an interactive map interface for drawing excavation locations using points, lines, or polygons
2. WHEN an Applicant draws on the map, THE DigiKop_System SHALL automatically detect which municipalities are affected
3. THE DigiKop_System SHALL require mandatory fields including project name, applicant organization, contractor, start date, end date, and work category
4. WHEN an Applicant submits a project for approval, THE DigiKop_System SHALL run automatic conflict detection within 10 seconds
5. THE DigiKop_System SHALL allow Applicants to save projects as drafts and edit them before submission

### Requirement 4

**User Story:** As a Municipal Coordinator, I want to create and manage moratoriums on specific areas, so that I can protect recently repaired roads and coordinate planned reconstructions.

#### Acceptance Criteria

1. THE DigiKop_System SHALL allow Municipal_Coordinators to draw moratorium areas on the map using lines or polygons
2. WHEN creating a moratorium, THE DigiKop_System SHALL require a reason, start date, end date, and optional exceptions text
3. THE DigiKop_System SHALL display active moratoriums as red hatched areas on the map with 40% transparency
4. WHEN an Applicant registers a project in a moratorium area, THE DigiKop_System SHALL display a warning message but not block submission
5. THE DigiKop_System SHALL validate that moratorium end dates do not exceed 5 years from creation

### Requirement 5

**User Story:** As any system user, I want to receive email notifications about relevant project events, so that I can stay informed about important changes and deadlines.

#### Acceptance Criteria

1. WHEN a project status changes, THE DigiKop_System SHALL send email notifications to relevant users within 5 minutes
2. THE DigiKop_System SHALL send notifications for new project submissions, approvals, rejections, conflicts detected, new comments, and approaching deadlines
3. WHEN a conflict is detected, THE DigiKop_System SHALL notify both the Municipal_Coordinator and the Applicant
4. THE DigiKop_System SHALL include project details, location, timeline, and a direct link to view the project in all notification emails
5. THE DigiKop_System SHALL format notification emails with clear subject lines prefixed with "[DigiKop]"

### Requirement 6

**User Story:** As a system user, I want to view projects on an interactive map with different visual states, so that I can understand the current status and location of all excavation works.

#### Acceptance Criteria

1. THE DigiKop_System SHALL display projects on the map with color-coded states: blue for forward planning, yellow for pending approval, green for approved, red for in progress, and gray for completed
2. WHEN a user clicks on a project on the map, THE DigiKop_System SHALL open a detailed sidebar panel with project information
3. THE DigiKop_System SHALL provide toggleable map layers including projects, moratoriums, municipal boundaries, and cadastral parcels
4. THE DigiKop_System SHALL allow users to filter visible projects by status, date range, category, and applicant
5. WHEN conflicts are detected, THE DigiKop_System SHALL highlight conflicting projects with orange borders and warning icons

### Requirement 7

**User Story:** As the system, I want to automatically detect spatial and temporal conflicts between excavation projects, so that overlapping works can be identified and coordinated.

#### Acceptance Criteria

1. WHEN a project is submitted for approval, THE DigiKop_System SHALL check for spatial overlaps using a 20-meter buffer zone around existing approved or in-progress projects
2. THE DigiKop_System SHALL detect temporal conflicts when project date ranges overlap with spatially conflicting projects
3. WHEN conflicts are detected, THE DigiKop_System SHALL flag the project with has_conflict status and store conflicting project IDs
4. THE DigiKop_System SHALL check for moratorium violations and display warnings for projects in restricted areas
5. THE DigiKop_System SHALL complete conflict detection analysis within 10 seconds of project submission

### Requirement 8

**User Story:** As a project stakeholder, I want to communicate through comments and track project history, so that I can coordinate effectively and maintain an audit trail.

#### Acceptance Criteria

1. THE DigiKop_System SHALL allow Applicants and Municipal_Coordinators to add comments to projects with text up to 1000 characters
2. WHEN a comment is added, THE DigiKop_System SHALL notify relevant users via email within 5 minutes
3. THE DigiKop_System SHALL maintain an automatic history log of all project status changes, edits, and comments with timestamps and user identification
4. THE DigiKop_System SHALL display comments in chronological order with user names, roles, and timestamps
5. THE DigiKop_System SHALL allow users to mention others using @username notation to trigger specific notifications