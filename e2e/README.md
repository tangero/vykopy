# DigiKop E2E Testing Suite

Comprehensive end-to-end testing suite for the DigiKop excavation coordination system using Playwright.

## Overview

This E2E testing suite covers all major user journeys and system functionality:

- **Authentication Flow**: Login, logout, session management
- **Project Workflow**: Complete project lifecycle from creation to approval
- **Map Interactions**: Map loading, drawing tools, layer controls
- **Moratorium Management**: Creating and managing area restrictions
- **User Management**: Role-based access control and permissions
- **Performance Testing**: Load testing, memory usage, network efficiency

## Test Structure

```
e2e/
├── fixtures/           # Test data and setup
│   └── seed-data.ts   # Database seeding for tests
├── tests/             # Test specifications
│   ├── auth.spec.ts
│   ├── project-workflow.spec.ts
│   ├── map-interactions.spec.ts
│   ├── moratorium-management.spec.ts
│   ├── user-management.spec.ts
│   ├── performance.spec.ts
│   └── load-testing.spec.ts
├── utils/             # Test utilities and helpers
│   ├── auth-helpers.ts
│   ├── map-helpers.ts
│   ├── project-helpers.ts
│   ├── test-data-manager.ts
│   └── test-reporter.ts
├── global-setup.ts    # Global test setup
├── global-teardown.ts # Global test cleanup
└── playwright.env.ts  # Environment configuration
```

## Running Tests

### Prerequisites

1. **Database Setup**: Ensure PostgreSQL with PostGIS is running
2. **Environment Variables**: Set up test environment variables
3. **Dependencies**: Install Playwright and dependencies

```bash
npm install
npx playwright install
```

### Test Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with browser UI visible
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug

# Run tests with Playwright UI
npm run test:e2e:ui

# View test report
npm run test:e2e:report

# Run specific test file
npx playwright test e2e/tests/auth.spec.ts

# Run tests on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Cross-Browser Testing

Tests are configured to run on multiple browsers:

- **Chromium** (Chrome/Edge)
- **Firefox**
- **WebKit** (Safari)
- **Mobile Chrome** (Pixel 5)
- **Mobile Safari** (iPhone 12)

### Performance Testing

Performance tests measure:

- **Page Load Times**: < 3 seconds
- **API Response Times**: < 2 seconds  
- **Map Load Times**: < 5 seconds
- **Conflict Detection**: < 10 seconds
- **Memory Usage**: Stable over extended sessions
- **Network Efficiency**: Optimized resource loading

## Test Data Management

### Seed Data

The test suite uses predefined test users and projects:

**Test Users:**
- `admin@digikop.cz` - Regional Administrator
- `coordinator@praha.cz` - Municipal Coordinator (Praha)
- `applicant@company.cz` - Project Applicant

**Test Projects:**
- Sample excavation projects in various states
- Conflicting projects for testing conflict detection
- Projects in different municipalities

### Data Cleanup

Tests automatically clean up test data to ensure isolation:

- Temporary test projects are removed
- User-generated test data is cleaned
- Database state is reset between test runs

## Environment Configuration

### Environment Variables

```bash
# Database
TEST_DATABASE_URL=postgresql://localhost:5432/digikop_test

# Application URLs
BASE_URL=http://localhost:3000
API_URL=http://localhost:3001

# Test Configuration
CI=false                    # Set to true in CI environment
SLOW_MO=0                  # Slow down actions (ms)
DEVTOOLS=false             # Open browser devtools
CLEANUP_TEST_DATA=true     # Clean up test data after tests
SEED_TEST_DATA=true        # Seed test data before tests
```

### Test Database Setup

1. Create test database:
```sql
CREATE DATABASE digikop_test;
```

2. Enable PostGIS extension:
```sql
\c digikop_test;
CREATE EXTENSION postgis;
```

3. Run migrations:
```bash
TEST_DATABASE_URL=postgresql://localhost:5432/digikop_test npm run migrate
```

## CI/CD Integration

### GitHub Actions

The test suite includes GitHub Actions workflows:

- **E2E Tests**: Run on every push and PR
- **Cross-Browser Tests**: Run on main branch pushes
- **Performance Tests**: Run nightly and on main branch

### Test Reports

Multiple report formats are generated:

- **HTML Report**: Visual test results with screenshots
- **JSON Report**: Machine-readable test data
- **JUnit Report**: For CI/CD integration
- **Custom Report**: DigiKop-specific test metrics

## Test Guidelines

### Writing Tests

1. **Use Page Object Pattern**: Utilize helper classes for common actions
2. **Test Isolation**: Each test should be independent
3. **Meaningful Assertions**: Verify actual user-visible behavior
4. **Performance Awareness**: Include timing assertions for critical paths
5. **Error Handling**: Test both success and failure scenarios

### Test Data

1. **Use Fixtures**: Leverage predefined test data
2. **Clean State**: Ensure tests start with known state
3. **Realistic Data**: Use data that reflects real usage
4. **Edge Cases**: Test boundary conditions and error states

### Debugging Tests

1. **Run in Headed Mode**: See browser interactions
2. **Use Debug Mode**: Step through test execution
3. **Screenshots**: Automatic screenshots on failure
4. **Video Recording**: Full test execution videos
5. **Trace Viewer**: Detailed execution traces

## Performance Benchmarks

### Target Performance Metrics

| Metric | Target | Critical |
|--------|--------|----------|
| Page Load | < 3s | < 5s |
| API Response | < 2s | < 5s |
| Map Load | < 5s | < 10s |
| Conflict Detection | < 10s | < 15s |
| Form Submission | < 3s | < 8s |

### Load Testing Scenarios

1. **Concurrent Users**: 5+ simultaneous sessions
2. **API Stress**: Rapid sequential requests
3. **Database Load**: Concurrent write operations
4. **Memory Usage**: Extended session monitoring
5. **Network Efficiency**: Bandwidth optimization

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure PostgreSQL is running and accessible
2. **Port Conflicts**: Check that ports 3000/3001 are available
3. **Browser Installation**: Run `npx playwright install` if browsers missing
4. **Test Data**: Verify test database has required seed data
5. **Timeouts**: Increase timeouts for slower environments

### Debug Commands

```bash
# Check Playwright installation
npx playwright --version

# List available browsers
npx playwright install --dry-run

# Test database connection
psql $TEST_DATABASE_URL -c "SELECT version();"

# Verify test data
psql $TEST_DATABASE_URL -c "SELECT count(*) FROM users;"
```

## Contributing

When adding new tests:

1. Follow existing patterns and helper usage
2. Add appropriate test data fixtures
3. Include performance assertions where relevant
4. Update documentation for new test scenarios
5. Ensure tests pass in all supported browsers

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Keep Playwright and browsers current
2. **Review Performance**: Monitor test execution times
3. **Clean Test Data**: Ensure proper cleanup mechanisms
4. **Update Fixtures**: Keep test data relevant and current
5. **Browser Updates**: Test with latest browser versions