#!/bin/bash

# DigiKop E2E Test Runner Script
# This script sets up and runs the complete E2E test suite

set -e

echo "🚀 DigiKop E2E Test Suite"
echo "========================="

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check if PostgreSQL is running
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed or not in PATH."
    exit 1
fi

# Check if test database exists
if ! psql "${TEST_DATABASE_URL:-postgresql://localhost:5432/digikop_test}" -c "SELECT 1;" &> /dev/null; then
    echo "❌ Test database is not accessible. Please ensure PostgreSQL is running and test database exists."
    echo "   Create with: createdb digikop_test"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm ci && cd ..
fi

# Install Playwright browsers if needed
echo "🌐 Checking Playwright browsers..."
if ! npx playwright --version &> /dev/null; then
    echo "📥 Installing Playwright browsers..."
    npx playwright install
fi

# Set up test environment
echo "🗄️ Setting up test environment..."
export NODE_ENV=test
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql://localhost:5432/digikop_test}"

# Run database migrations
echo "🔄 Running database migrations..."
npm run migrate

# Build application
echo "🔨 Building application..."
npm run build

# Parse command line arguments
TEST_TYPE="all"
BROWSER="chromium"
HEADED=false
DEBUG=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            TEST_TYPE="$2"
            shift 2
            ;;
        --browser)
            BROWSER="$2"
            shift 2
            ;;
        --headed)
            HEADED=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --type <type>     Test type: all, auth, workflow, map, moratorium, user, performance, load"
            echo "  --browser <name>  Browser: chromium, firefox, webkit"
            echo "  --headed          Run tests in headed mode (visible browser)"
            echo "  --debug           Run tests in debug mode"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Build test command
TEST_CMD="npx playwright test"

if [ "$HEADED" = true ]; then
    TEST_CMD="$TEST_CMD --headed"
fi

if [ "$DEBUG" = true ]; then
    TEST_CMD="$TEST_CMD --debug"
fi

if [ "$BROWSER" != "all" ]; then
    TEST_CMD="$TEST_CMD --project=$BROWSER"
fi

# Select test files based on type
case $TEST_TYPE in
    auth)
        TEST_CMD="$TEST_CMD e2e/tests/auth.spec.ts"
        ;;
    workflow)
        TEST_CMD="$TEST_CMD e2e/tests/project-workflow.spec.ts"
        ;;
    map)
        TEST_CMD="$TEST_CMD e2e/tests/map-interactions.spec.ts"
        ;;
    moratorium)
        TEST_CMD="$TEST_CMD e2e/tests/moratorium-management.spec.ts"
        ;;
    user)
        TEST_CMD="$TEST_CMD e2e/tests/user-management.spec.ts"
        ;;
    performance)
        TEST_CMD="$TEST_CMD e2e/tests/performance.spec.ts"
        ;;
    load)
        TEST_CMD="$TEST_CMD e2e/tests/load-testing.spec.ts"
        ;;
    all)
        # Run all tests
        ;;
    *)
        echo "❌ Unknown test type: $TEST_TYPE"
        echo "Valid types: all, auth, workflow, map, moratorium, user, performance, load"
        exit 1
        ;;
esac

echo "🧪 Running E2E tests..."
echo "Command: $TEST_CMD"
echo ""

# Run the tests
eval $TEST_CMD

# Check if tests passed
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
    echo "📊 View detailed report: npm run test:e2e:report"
else
    echo ""
    echo "❌ Some tests failed!"
    echo "📊 View detailed report: npm run test:e2e:report"
    exit 1
fi