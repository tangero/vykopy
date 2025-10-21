# DigiKop Deployment Guide

## Railway.app Deployment

### Prerequisites

1. **GitHub Repository**: Ensure your code is pushed to a GitHub repository
2. **Railway Account**: Sign up at [railway.app](https://railway.app)
3. **Environment Variables**: Prepare all required environment variables

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your DigiKop repository
5. Railway will automatically detect the Node.js project

### Step 2: Configure PostgreSQL Database

1. In your Railway project dashboard, click "New Service"
2. Select "Database" → "PostgreSQL"
3. Railway will create a PostgreSQL instance
4. Note the connection details from the "Variables" tab

### Step 3: Enable PostGIS Extension

1. Connect to your PostgreSQL database using the provided credentials
2. Run the following SQL commands:

```sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Verify installation
SELECT PostGIS_Version();
```

### Step 4: Configure Environment Variables

In your Railway project settings, add the following environment variables:

#### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database
POSTGRES_DB=digikop_prod

# Application
NODE_ENV=production
PORT=3001
API_PREFIX=/api

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# Email Service (SendGrid recommended)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com

# File Storage
UPLOAD_PATH=/app/uploads
MAX_FILE_SIZE=10485760

# Map Services
MAPBOX_ACCESS_TOKEN=your-mapbox-access-token

# Frontend URL (for CORS)
FRONTEND_URL=https://your-app-name.railway.app

# Security
TRUST_PROXY=true
RATE_LIMIT_ENABLED=true

# Monitoring (optional)
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
```

#### Optional Variables

```bash
# Email Templates
EMAIL_TEMPLATE_PATH=/app/templates
NOTIFICATION_QUEUE_ENABLED=true

# Performance
DB_POOL_SIZE=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=30000

# Security
VIRUS_SCAN_ENABLED=false
AUDIT_LOG_RETENTION_DAYS=90
```

### Step 5: Configure Automatic Deployments

1. In Railway project settings, go to "GitHub"
2. Enable "Auto Deploy" for your main branch
3. Configure branch protection rules in GitHub (recommended)

### Step 6: Database Migration

After deployment, run the database migration:

1. Go to your Railway project dashboard
2. Open the service terminal or use Railway CLI
3. Run the migration script:

```bash
# Using Railway CLI
railway run npm run migrate

# Or connect to the deployed service and run:
node dist/scripts/migrate.js
```

### Step 7: Verify Deployment

1. Check the deployment logs in Railway dashboard
2. Visit your application URL
3. Test the health check endpoint: `https://your-app.railway.app/api/health`
4. Verify database connectivity and PostGIS functionality

## Environment-Specific Configurations

### Production Environment

```bash
NODE_ENV=production
LOG_LEVEL=warn
RATE_LIMIT_ENABLED=true
TRUST_PROXY=true
```

### Staging Environment

```bash
NODE_ENV=staging
LOG_LEVEL=debug
RATE_LIMIT_ENABLED=false
```

## Monitoring Setup

### 1. Sentry Integration

Add Sentry for error tracking:

```bash
npm install @sentry/node @sentry/tracing
```

Configure in your Railway environment:

```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=1.0.0
```

### 2. Health Check Endpoint

The application includes a health check at `/api/health`:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "database": "connected",
  "services": {
    "email": "connected",
    "storage": "available"
  }
}
```

### 3. Logging Configuration

Configure structured logging:

```bash
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DESTINATION=stdout
```

### 4. Performance Monitoring

Monitor key metrics:
- Response times
- Database query performance
- Memory usage
- Error rates
- Active connections

## Backup Strategy

### Database Backups

Railway provides automatic backups for PostgreSQL:
1. Go to your database service in Railway
2. Navigate to "Backups" tab
3. Configure backup frequency (daily recommended)
4. Set retention period (30 days recommended)

### File Storage Backups

If using local file storage:
1. Configure Railway volumes for persistent storage
2. Set up periodic backup scripts
3. Consider using cloud storage (AWS S3, Google Cloud Storage)

## Scaling Considerations

### Horizontal Scaling

Railway supports horizontal scaling:
1. Go to service settings
2. Adjust "Replicas" setting
3. Configure load balancing

### Database Scaling

For high-traffic scenarios:
1. Consider read replicas
2. Implement connection pooling
3. Optimize PostGIS queries
4. Use Redis for caching

## Security Checklist

- [ ] HTTPS enabled (automatic with Railway)
- [ ] Environment variables secured
- [ ] Database access restricted
- [ ] Rate limiting configured
- [ ] Input validation implemented
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] File upload restrictions in place
- [ ] Audit logging enabled

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify DATABASE_URL format
   - Check PostGIS extension installation
   - Ensure database is accessible

2. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are listed
   - Review build logs for specific errors

3. **Runtime Errors**
   - Check environment variables
   - Review application logs
   - Verify external service connectivity

### Debugging Commands

```bash
# Check logs
railway logs

# Connect to service
railway shell

# Run database queries
railway run psql $DATABASE_URL

# Check environment variables
railway variables
```

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review error logs
   - Check performance metrics
   - Verify backup integrity

2. **Monthly**
   - Update dependencies
   - Review security settings
   - Analyze usage patterns

3. **Quarterly**
   - Security audit
   - Performance optimization
   - Disaster recovery testing

### Updates and Patches

1. Test updates in staging environment
2. Schedule maintenance windows
3. Monitor deployment closely
4. Have rollback plan ready

## Support

For deployment issues:
1. Check Railway documentation
2. Review application logs
3. Contact Railway support if needed
4. Consult DigiKop documentation

## Cost Optimization

### Railway Pricing Tiers

- **Hobby Plan**: $5/month - suitable for development
- **Pro Plan**: $20/month - recommended for production
- **Team Plan**: $20/user/month - for team collaboration

### Cost-Saving Tips

1. Use appropriate instance sizes
2. Optimize database queries
3. Implement caching strategies
4. Monitor resource usage
5. Clean up unused services