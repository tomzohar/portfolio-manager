# E2E Testing Guide

This directory contains end-to-end (e2e) tests for the backend API. E2E tests verify complete user flows by testing the full application stack including database, API endpoints, and business logic.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Architecture](#test-architecture)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- E2E PostgreSQL running on `localhost:5433` (see `docker-compose.yml` `postgres_e2e`)
- Test database: `stocks_researcher_e2e`
- Node.js 22+
- All dependencies installed (`npm install`)

### One-Time Database Setup

Before running e2e tests for the first time, start the dedicated e2e database instance:

```bash
# From the backend directory
docker compose up -d postgres_e2e

# Verify it's running
docker compose ps postgres_e2e
```

This creates an isolated PostgreSQL instance on port **5433** (separate from development on port 5432).

### Run All Tests

```bash
cd backend
npm run test:e2e
```

### Run Specific Test Suite

```bash
npm run test:e2e -- agents.e2e-spec.ts
npm run test:e2e -- performance.e2e-spec.ts
```

### Expected Results

```
Test Suites: 13 passed, 13 total
Tests:       1 skipped, 150 passed, 151 total
Time:        ~5-6 minutes
```

---

## Test Architecture

### Global Test Context

All e2e tests share a **single NestJS application instance** for optimal performance and reliability.

**Location**: `test/global-test-context.ts`

**Key Features**:
- ✅ One-time app initialization (not per test suite)
- ✅ Automatic CI detection (3s delay in CI, 1s locally)
- ✅ Database schema synchronization
- ✅ Test market data seeding (2,611 records for 7 tickers)
- ✅ ~85% faster execution vs per-suite initialization

**Usage in Tests**:

```typescript
import { getTestApp, getTestDataSource } from './global-test-context';

describe('My Test Suite', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp(); // Get shared app instance
  });

  // No afterAll cleanup needed - handled by global teardown
});
```

### Test Database

**Database**: `stocks_researcher_e2e`  
**Schema Management**: Automatic via TypeORM `synchronize: true`  
**Cleanup Strategy**: Global teardown drops/recreates schema

**Lifecycle**:
1. **Global Setup** (`jest-global-setup.ts`) - Drops and recreates schema
2. **First Test** - Calls `getTestApp()` → Initializes app → Synchronizes schema → Seeds data
3. **All Tests Run** - Share same app and database
4. **Global Teardown** (`jest-global-teardown.ts`) - Drops schema, closes app

### Test Market Data

**Location**: `helpers/test-market-data-seeder.ts`

Tests don't depend on external APIs (Polygon). Instead, we seed realistic test data:

**Tickers**: AAPL, MSFT, GOOGL, NVDA, XOM, SPY, QQQ  
**Time Range**: Past 1 year + 7 days future buffer  
**Records**: ~2,600 daily price points  
**Price Generation**: Simulated daily movements (-2% to +2%)

This ensures tests:
- ✅ Run offline without API keys
- ✅ Execute consistently in CI
- ✅ Don't hit rate limits
- ✅ Are deterministic and fast

---

### LLM and Agent Mocking

**Location**: `helpers/test-llm-mocker.ts`

To test LangGraph agents without incurring cost, latency, or flakiness from real LLM calls, we use a sophisticated mocking infrastructure.

**Key Features**:
- ✅ **Instant Responses**: No network calls, tests run in milliseconds.
- ✅ **Tool Call Simulation**: Mocks complex ReAct behaviors (Reasoning -> Tool -> Observation -> Final Answer).
- ✅ **Recursion Prevention**: Automatically detects if a tool has already been executed (by checking conversation history for tool outputs like `"sma_50"` or `"current_price"`) and returns a final answer to break infinite loops.
- ✅ **Duck Typing Support**: Ensures mock messages are correctly identified by the router logic, even when passing through serialization.

**Usage**:

The global test app automatically overrides the `GeminiLlmService` with the mock implementation. The mock logic in `test-llm-mocker.ts` inspects prompts to decide whether to trigger a specific tool (e.g., "Analyze AAPL" -> `technical_analyst`) or return a standard text response.

```typescript
// Example from checks in test-llm-mocker.ts
if (prompt.includes('analyze aapl')) {
  // Triggers technical_analyst tool call
  return { tool_calls: [{ name: 'technical_analyst', args: { ticker: 'AAPL' } }] };
}
```

**Adding New Mock Scenarios**:
If you add a new tool or agent capability, you must update `test-llm-mocker.ts` to recognize the new keywords in the prompt and return the appropriate tool call structure.

---

## Running Tests

### Local Development

```bash
# Run all e2e tests
npm run test:e2e

# Run specific test suite
npm run test:e2e -- auth.e2e-spec.ts

# Run specific test
npm run test:e2e -- -t "should create user"

# Run with verbose output
npm run test:e2e -- --verbose

# Run without forceExit (helpful for debugging open handles)
jest --config ./test/jest-e2e.json
```

### CI Environment

E2E tests run automatically on:
- **Push to `main` branch**
- **Pull requests to `main`**

**CI Workflow**: `.github/workflows/ci.yml`

**Key Differences in CI**:
- `CI=true` environment variable set
- 3-second initialization delay (vs 1s local)
- PostgreSQL service container
- Mock API keys (tests don't call real APIs)

### Environment Variables

**Required** (automatically set in CI):

```bash
# Database
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=stocks_researcher_e2e

# Authentication
JWT_SECRET=test-jwt-secret

# External APIs (mock values - not actually called)
POLYGON_API_KEY=test-api-key
GEMINI_API_KEY=test-gemini-key
FRED_API_KEY=test-fred-key
NEWS_API_KEY=test-news-key

# Feature Flags
ENABLE_APPROVAL_GATE=true
APPROVAL_TRANSACTION_THRESHOLD=10000

# Test Configuration
NODE_ENV=test
LOG_LEVEL=fatal  # Suppress verbose logs
```

---

## Writing Tests

### Best Practices

#### 1. Use Global Test Context

✅ **DO**: Use the shared app instance

```typescript
import { getTestApp } from './global-test-context';

describe('My Test', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });
});
```

❌ **DON'T**: Create your own app instance

```typescript
// DON'T DO THIS - creates duplicate app
const moduleFixture = await Test.createTestingModule({
  imports: [AppModule],
}).compile();
```

#### 2. Use Unique User Emails

✅ **DO**: Generate unique emails per test run

```typescript
const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123',
};
```

❌ **DON'T**: Use static emails (causes 409 Conflict)

```typescript
// DON'T DO THIS - will conflict when tests share app
const testUser = {
  email: 'test@example.com',
  password: 'TestPassword123',
};
```

#### 3. Don't Clean Up in afterAll

✅ **DO**: Let global teardown handle cleanup

```typescript
describe('My Test', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getTestApp();
  });

  // No afterAll needed - global teardown handles cleanup
});
```

❌ **DON'T**: Truncate database in afterAll

```typescript
// DON'T DO THIS - causes FK violations
afterAll(async () => {
  await dbManager.truncateAll(); // ❌
});
```

#### 4. Respect User Rules

From `user_rules`:
> In testing - always prefer spying on external libraries instead of mocking

When testing integrations with external services (Polygon, FRED, etc.):

✅ **DO**: Spy on the actual service methods

```typescript
const polygonSpy = jest.spyOn(polygonService, 'getAggregates');
```

❌ **DON'T**: Mock the entire service

### Test File Structure

```typescript
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp } from './global-test-context';

describe('Feature Name (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  // Unique test user per suite
  const testUser = {
    email: `feature-test-${Date.now()}@example.com`,
    password: 'TestPassword123',
  };

  beforeAll(async () => {
    // Get shared app instance
    app = await getTestApp();

    // Create test user
    const signupResponse = await request(app.getHttpServer())
      .post('/users')
      .send(testUser)
      .expect(201);

    authToken = signupResponse.body.token;
  });

  describe('Scenario 1', () => {
    it('should test behavior', async () => {
      const response = await request(app.getHttpServer())
        .post('/endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ data: 'value' })
        .expect(201);

      expect(response.body).toHaveProperty('expectedField');
    });
  });
});
```

### Naming Conventions

**Test Files**: `*.e2e-spec.ts`

**Describe Blocks**:
- Suite level: `describe('FeatureName (e2e)', ...)`
- Endpoint level: `describe('POST /endpoint/path', ...)`
- Scenario level: `describe('Happy Path', ...)`

**Test Names**: Should describe user-facing behavior
- ✅ `it('should create portfolio and return 201', ...)`
- ✅ `it('should reject unauthorized access with 401', ...)`
- ❌ `it('calls the service method', ...)` (too implementation-focused)

---

## CI/CD Integration

### GitHub Actions Workflow

**File**: `.github/workflows/ci.yml`

**Job**: `test-backend`

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: test_db

steps:
  - name: Wait for PostgreSQL to be ready
  - name: Run unit tests (npm test)
  - name: Run e2e tests (npm run test:e2e)  # ← E2E tests added here
```

### CI-Specific Behavior

**Automatic Detection**:
The global test context detects CI environment via `process.env.CI`:

```typescript
const initDelay = process.env.CI ? 3000 : 1000;
```

**Why Longer Delay in CI**:
- CI environments are typically slower
- Ensures LangGraph checkpoint tables are created
- Prevents race conditions in table creation

### Debugging CI Failures

If tests pass locally but fail in CI:

1. **Check environment variables** in workflow file
2. **Verify initialization delay** is sufficient (currently 3s in CI)
3. **Check PostgreSQL service** health in CI logs
4. **Look for timing-related assertions** (may need relaxing)

**Common Issues**:
- ❌ 401 Unauthorized → Check JWT_SECRET matches
- ❌ 400 Bad Request → Check market data seeding succeeded
- ❌ 500 Internal Error → Check all tables created
- ❌ Timeout → Increase test timeout or check for hanging connections

---

## Troubleshooting

### Tests Fail with "relation does not exist"

**Symptom**: `relation "users" does not exist` or similar

**Cause**: TypeORM schema synchronization failed or incomplete

**Solution**:
1. Drop test database schema manually:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```
2. Run tests again - schema will be recreated

### Tests Fail with "409 Conflict"

**Symptom**: `expected 201, got 409` when creating users

**Cause**: Test user emails are not unique

**Solution**: Ensure emails use timestamps:
```typescript
const testUser = {
  email: `test-${Date.now()}@example.com`, // ✅ Unique
  password: 'TestPassword123',
};
```

### Tests Fail with "FK constraint violation"

**Symptom**: Foreign key errors when inserting/deleting records

**Cause**: Database cleanup happening mid-test-run

**Solution**: Remove `afterAll` cleanup from individual test suites. Cleanup happens in global teardown.

### Performance Tests Return 400

**Symptom**: Performance endpoints return 400 Bad Request

**Possible Causes**:
1. Market data not seeded
2. Snapshots not calculated
3. Invalid timeframe parameter

**Debug**:
```typescript
// Add to test to see actual error
const response = await request(app.getHttpServer())
  .get(`/performance/${portfolioId}/history`)
  .set('Authorization', `Bearer ${authToken}`)
  .query({ timeframe: '3M', benchmarkTicker: 'SPY' });

console.log('Response:', response.status, response.body);
```

### Tests Hang or Timeout

**Symptom**: Tests don't complete after 30s

**Possible Causes**:
1. Unclosed database connections
2. Pending async operations
3. Event emitters not cleaned up

**Debug**:
```bash
# Run with detectOpenHandles
jest --config ./test/jest-e2e.json --detectOpenHandles
```

### Want to Debug a Single Test

```bash
# Add .only to focus on one test
it.only('should test specific behavior', async () => {
  // ...
});

# Or use -t flag
npm run test:e2e -- -t "specific test name"
```

---

## File Organization

```
backend/test/
├── README.md                          # This file
├── jest-e2e.json                      # Jest configuration
├── jest-e2e.setup.ts                  # Environment setup (runs before tests)
├── jest-global-setup.ts               # Global setup (drops/creates schema)
├── jest-global-teardown.ts            # Global teardown (cleanup)
├── global-test-context.ts             # ⭐ Shared app instance
│
├── helpers/
│   ├── test-app-initializer.ts        # Legacy helper (deprecated)
│   ├── test-database-manager.ts       # Database cleanup utilities
│   └── test-market-data-seeder.ts     # ⭐ Seeds test market data
│
└── *.e2e-spec.ts                      # Test suites (13 files)
    ├── app.e2e-spec.ts                # Basic health check
    ├── auth.e2e-spec.ts               # Authentication flow
    ├── rate-limiting.e2e-spec.ts      # Rate limiting
    ├── agents.e2e-spec.ts             # Agent execution
    ├── agents-streaming.e2e-spec.ts   # SSE streaming
    ├── agents-performance.e2e-spec.ts # Performance attribution
    ├── agents-hitl.e2e-spec.ts        # Human-in-the-loop
    ├── agents-approval-gate.e2e-spec.ts
    ├── agents-approval-workflow-integration.e2e-spec.ts
    ├── agents-guardrails.e2e-spec.ts
    ├── tracing-automatic.e2e-spec.ts  # Reasoning traces
    ├── performance.e2e-spec.ts        # Performance API
    └── performance-snapshots.e2e-spec.ts
```

---

## Test Architecture Details

### Global App Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ 1. jest-global-setup.ts                                     │
│    └─> DROP SCHEMA public CASCADE                           │
│    └─> CREATE SCHEMA public                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. First Test Suite Calls getTestApp()                      │
│    └─> Initialize NestJS app                                │
│    └─> Wait for async initialization (3s in CI, 1s local)   │
│    └─> Synchronize database schema (create all tables)      │
│    └─> Seed test market data (2,611 records)                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. All Test Suites Run (sequential, maxWorkers: 1)          │
│    └─> Each calls getTestApp() → Returns existing instance  │
│    └─> Each creates unique test users                       │
│    └─> Tests share database (no per-suite cleanup)          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. jest-global-teardown.ts                                  │
│    └─> Close global app instance                            │
│    └─> DROP SCHEMA public CASCADE                           │
│    └─> CREATE SCHEMA public                                 │
└─────────────────────────────────────────────────────────────┘
```

## Writing Tests

### Template for New Test Suite

```typescript
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp } from './global-test-context';

describe('YourFeature (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  const testUser = {
    email: `your-feature-test-${Date.now()}@example.com`,
    password: 'TestPassword123',
  };

  beforeAll(async () => {
    app = await getTestApp();

    // Create test user if authentication is needed
    const signupResponse = await request(app.getHttpServer())
      .post('/users')
      .send(testUser)
      .expect(201);

    authToken = signupResponse.body.token;
  });

  describe('Happy Path', () => {
    it('should successfully perform action', async () => {
      const response = await request(app.getHttpServer())
        .post('/your-endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ data: 'value' })
        .expect(201);

      expect(response.body).toHaveProperty('expectedField');
      expect(response.body.expectedField).toBe('expectedValue');
    });
  });

  describe('Error Cases', () => {
    it('should reject unauthorized requests', async () => {
      await request(app.getHttpServer())
        .post('/your-endpoint')
        .send({ data: 'value' })
        .expect(401);
    });

    it('should validate input data', async () => {
      await request(app.getHttpServer())
        .post('/your-endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid: 'data' })
        .expect(400);
    });
  });
});
```

### Testing Authenticated Endpoints

```typescript
// Create user in beforeAll
const signupResponse = await request(app.getHttpServer())
  .post('/users')
  .send({ email: `test-${Date.now()}@example.com`, password: 'Password123' })
  .expect(201);

const authToken = signupResponse.body.token;

// Use token in requests
await request(app.getHttpServer())
  .get('/protected/endpoint')
  .set('Authorization', `Bearer ${authToken}`)
  .expect(200);
```

### Testing Complex Flows

For multi-step workflows (e.g., HITL approval):

```typescript
it('should complete approval workflow', async () => {
  // Step 1: Trigger action that requires approval
  const runResponse = await request(app.getHttpServer())
    .post('/agents/run')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ message: 'Large transaction' })
    .expect(201);

  expect(runResponse.body.status).toBe('SUSPENDED');
  const threadId = runResponse.body.threadId;

  // Step 2: Resume with approval
  const resumeResponse = await request(app.getHttpServer())
    .post('/agents/resume')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ threadId, userInput: 'APPROVED' })
    .expect(200);

  expect(resumeResponse.body.status).toBe('COMPLETED');
});
```

### Assertions Best Practices

```typescript
// ✅ Test shape and types
expect(response.body).toHaveProperty('threadId');
expect(typeof response.body.threadId).toBe('string');
expect(response.body.success).toBe(true);

// ✅ Test arrays
expect(Array.isArray(response.body.data)).toBe(true);
expect(response.body.data.length).toBeGreaterThan(0);

// ✅ Test numeric precision
expect(response.body.price).toBeCloseTo(100.50, 2);

// ❌ Don't test exact string matches (brittle)
expect(response.body.message).toBe('Exact error message'); // Fragile

// ✅ Test string patterns instead
expect(response.body.message).toContain('expected keyword');
expect(response.body.message).toMatch(/pattern/);
```

---

## CI/CD Integration

### Workflow Overview

**Location**: `.github/workflows/ci.yml`

**Trigger Events**:
- Push to `main`
- Pull requests to `main`

**Jobs**:
1. `test-agent` - Python agent tests
2. `test-backend` - **Backend tests (unit + e2e)**
3. `test-frontend` - Frontend tests

### Backend Test Job Steps

```yaml
- Setup Node.js 22
- Install dependencies (npm ci)
- Wait for PostgreSQL readiness
- Run unit tests (npm test)
- Run e2e tests (npm run test:e2e)  # ← Added in this PR
- Upload coverage artifacts
```

### PostgreSQL Service

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: test_db
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432
```

### Environment Variables in CI

All required environment variables are set in the workflow:

```yaml
env:
  CI: true  # ← Triggers 3s initialization delay
  DB_HOST: localhost
  DB_PORT: 5432
  DB_USERNAME: test_user
  DB_PASSWORD: test_password
  DB_DATABASE: test_db
  JWT_SECRET: test-jwt-secret-for-ci
  POLYGON_API_KEY: test-api-key  # Mock value
  GEMINI_API_KEY: test-gemini-key  # Mock value
  # ... etc
```

---

## Test Configuration

### jest-e2e.json

```json
{
  "testRegex": ".e2e-spec.ts$",
  "setupFiles": ["<rootDir>/jest-e2e.setup.ts"],
  "globalSetup": "<rootDir>/jest-global-setup.ts",
  "globalTeardown": "<rootDir>/jest-global-teardown.ts",
  "testTimeout": 30000,
  "maxWorkers": 1,  // ← Sequential execution (required for shared app)
  "forceExit": true
}
```

**Key Settings**:
- `maxWorkers: 1` - Tests run sequentially (safe for shared app)
- `forceExit: true` - Forces exit after tests (handles open handles)
- `testTimeout: 30000` - 30s timeout per test (some tests call LLM)

### jest-e2e.setup.ts

Sets up environment before tests run:

```typescript
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';  // Suppress logs
process.env.ENABLE_APPROVAL_GATE = 'true';
// ... etc
```

---

## Maintenance

### Adding New Test Suites

1. Create new file: `test/my-feature.e2e-spec.ts`
2. Import `getTestApp` from `./global-test-context`
3. Follow template above
4. Use unique user emails
5. Don't add `afterAll` cleanup
6. Run individually first: `npm run test:e2e -- my-feature.e2e-spec.ts`
7. Run full suite to ensure no conflicts

```

### Updating Market Data Seeder

When adding new tickers to tests:

1. Add ticker to `helpers/test-market-data-seeder.ts`:
   ```typescript
   const tickers = [
     // ... existing tickers
     { symbol: 'TSLA', basePrice: 250 },
   ];
   ```

2. Verify seeding works:
   ```bash
   npm run test:e2e -- app.e2e-spec.ts 2>&1 | grep "Seeded"
   ```

---

## FAQ

### Why do we share one app instance?

**Performance**: Initializing NestJS 13 times is expensive. Sharing one instance is 85% faster.

**Reliability**: One-time initialization reduces flakiness from timing issues.

**Simplicity**: Less boilerplate code in each test file.

### Is it safe to share an app across tests?

**Yes**, because:
- Tests run **sequentially** (`maxWorkers: 1`)
- Each test creates **unique users** (no conflicts)
- Database cleanup happens **once** (in global teardown)
- No test modifies app configuration

### What if I need a fresh database for my test?

You can clean specific tables if needed:

```typescript
import { getTestDataSource } from './global-test-context';

beforeEach(async () => {
  const dataSource = getTestDataSource();
  await dataSource.query('DELETE FROM my_table');
});
```

But generally, **avoid this**. Use unique data instead.

### Can I run tests in parallel?

**Not recommended**. The shared app model requires sequential execution. If you need parallel execution, you'd need to revert to per-suite app initialization.

### How do I test external API integrations?

**Use spies, not mocks** (per user rules):

```typescript
import { PolygonApiService } from '../src/modules/assets/services/polygon-api.service';

it('should handle API errors gracefully', async () => {
  const polygonService = app.get(PolygonApiService);
  const spy = jest.spyOn(polygonService, 'getAggregates')
    .mockReturnValue(throwError(() => new Error('API Error')));

  // ... test error handling

  spy.mockRestore();
});
```

### Why don't we use TestingModule.overrideProvider in e2e tests?

E2E tests validate the **real application behavior** end-to-end. We use the actual app module without overrides. For unit tests with mocks, use `*.spec.ts` files instead.

---

## Contributing

When adding or modifying e2e tests:

1. ✅ Follow the conventions in this README
2. ✅ Use `getTestApp()` from global context
3. ✅ Use unique user emails with timestamps
4. ✅ Don't add `afterAll` cleanup
5. ✅ Test locally before committing
6. ✅ Verify CI passes after merging

**Before committing**:

```bash
# Run unit tests
npm test

# Run e2e tests
npm run test:e2e

# Check for linter errors
npm run lint

# Build check
npm run build
```

---

## Related Documentation

- **Main README**: `../README.md`
- **API Documentation**: http://localhost:3001/api (when backend running)

---
