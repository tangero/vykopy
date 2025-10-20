# Notification System Implementation

This document describes the notification system implementation for DigiKop, covering automatic notifications for project state changes, conflict detection, and approaching deadlines.

## Overview

The notification system consists of several interconnected services:

1. **NotificationTriggers** - Event handlers that trigger notifications
2. **NotificationService** - Core notification logic and email sending
3. **EmailService** - Email template generation and delivery
4. **EmailQueue** - Queue management for reliable email delivery
5. **DeadlineScheduler** - Scheduled tasks for deadline notifications

## Implemented Features

### 1. Automatic Project State Change Notifications

**Trigger**: When project state changes (draft → pending_approval → approved → in_progress → completed)

**Recipients**:
- **Project submission**: Municipal coordinators in affected territories
- **Project approval/rejection**: Project applicant
- **State changes**: Relevant stakeholders based on project state

**Implementation**: `NotificationTriggers.onProjectStateChanged()`

### 2. Conflict Detection Notifications

**Trigger**: When spatial or temporal conflicts are detected between projects

**Recipients**:
- Project applicant (for the new project)
- Municipal coordinators (for affected territories)
- Applicants of conflicting projects

**Features**:
- Automatic conflict detection on project submission
- Re-detection when project geometry or dates change
- Notification of all affected parties

**Implementation**: `NotificationTriggers.onConflictsDetected()`

### 3. Deadline Approaching Notifications

**Trigger**: Scheduled daily checks for approaching project deadlines

**Notification Schedule**:
- **7 days before start**: Early warning notification
- **3 days before start**: Final reminder notification
- **Overdue projects**: Daily notifications for projects that should have started

**Recipients**:
- Project applicant
- Municipal coordinators (for approved projects)

**Implementation**: 
- `DeadlineScheduler` - Runs daily at 9:00 AM Prague time
- `NotificationService.checkApproachingDeadlines()`
- `NotificationService.notifyDeadlineApproaching()`

### 4. Additional Notifications

#### User Registration
- **Trigger**: New user registration
- **Recipients**: Regional administrators
- **Purpose**: Admin approval workflow

#### Moratorium Creation
- **Trigger**: New moratorium created
- **Recipients**: All users in affected municipality
- **Purpose**: Inform about new restrictions

#### Project Comments
- **Trigger**: New comment added to project
- **Recipients**: Project stakeholders (applicant, coordinators)
- **Purpose**: Communication and collaboration

#### Project Updates
- **Trigger**: Significant project changes (geometry, dates)
- **Recipients**: Municipal coordinators
- **Purpose**: Keep coordinators informed of changes

## Technical Implementation

### Notification Flow

```
Event Occurs → NotificationTriggers → NotificationService → EmailService → EmailQueue → SMTP
```

### Key Components

#### NotificationTriggers
- Event handlers for all notification scenarios
- Integrates with route handlers (projects, auth, moratoriums)
- Handles async notification processing
- Manages conflict detection integration

#### NotificationService
- Core business logic for notifications
- Recipient determination based on roles and territories
- Template selection and data preparation
- Batch processing for efficiency

#### EmailService
- HTML and text email template generation
- SMTP configuration and connection management
- Immediate and queued email sending
- Template rendering with project/user data

#### EmailQueue
- Priority-based email queuing
- Retry logic with exponential backoff
- Failed email tracking and management
- Queue monitoring and statistics

#### DeadlineScheduler
- Cron-based scheduling (daily at 9:00 AM)
- Manual trigger capability for testing
- Status monitoring and statistics
- One-time scheduling for specific dates

### Integration Points

#### Route Integration
All notification triggers are integrated into relevant API routes:

- **Projects**: Create, update, state change, comments
- **Auth**: User registration
- **Moratoriums**: Create moratorium
- **Admin**: Manual notification management

#### Database Integration
- Conflict status updates in projects table
- Audit trail logging for state changes
- Territory-based access control for notifications

### Configuration

#### Email Configuration
```typescript
// Environment variables
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-key
EMAIL_FROM=noreply@digikop.cz
```

#### Scheduler Configuration
- **Default schedule**: Daily at 9:00 AM Prague time
- **Timezone**: Europe/Prague
- **Batch size**: 100 projects per check
- **Retry attempts**: 3 with exponential backoff

### Monitoring and Administration

#### Admin Endpoints
- `GET /api/admin/notifications/status` - System status
- `POST /api/admin/notifications/deadline-check` - Manual deadline check
- `GET /api/admin/email/status` - Email queue status
- `POST /api/admin/email/test` - Test email configuration

#### Queue Management
- Failed email retry
- Queue statistics and monitoring
- Email removal and cleanup
- Priority-based processing

### Error Handling

#### Graceful Degradation
- Notifications failures don't block main operations
- Async processing prevents route delays
- Retry mechanisms for transient failures
- Comprehensive error logging

#### Monitoring
- Email delivery status tracking
- Queue health monitoring
- Scheduler status monitoring
- Error rate tracking

## Testing

### Unit Tests
- NotificationTriggers functionality
- Email template generation
- Queue management operations
- Scheduler behavior

### Integration Tests
- End-to-end notification flows
- Database integration
- SMTP connectivity
- Route integration

### Manual Testing
- Admin interface for testing
- Email configuration verification
- Manual deadline checks
- Queue monitoring

## Performance Considerations

### Async Processing
- All notifications processed asynchronously
- Non-blocking route handlers
- Background queue processing

### Batch Operations
- Bulk deadline checking
- Efficient database queries
- Optimized recipient determination

### Resource Management
- Connection pooling for database
- SMTP connection reuse
- Memory-efficient queue management

## Security

### Data Protection
- No sensitive data in email templates
- Secure SMTP configuration
- Rate limiting for email sending

### Access Control
- Territory-based notification filtering
- Role-based recipient determination
- Admin-only management endpoints

## Future Enhancements

### Potential Improvements
1. **Push Notifications**: Browser/mobile push notifications
2. **SMS Integration**: Critical deadline notifications via SMS
3. **Webhook Support**: Integration with external systems
4. **Advanced Templates**: Rich HTML templates with attachments
5. **Analytics**: Notification delivery and engagement metrics
6. **Personalization**: User preference management
7. **Escalation**: Automatic escalation for critical notifications

### Scalability
1. **Redis Queue**: Replace in-memory queue with Redis
2. **Microservices**: Separate notification service
3. **Load Balancing**: Distributed notification processing
4. **Database Optimization**: Notification-specific database optimizations