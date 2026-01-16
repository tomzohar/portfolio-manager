<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

Backend server for the Stocks Researcher application. This NestJS application provides REST API endpoints for portfolio management and integrates with a PostgreSQL database.

## Features

- **Database**: PostgreSQL with TypeORM integration
- **Configuration**: Environment-based configuration with @nestjs/config
- **Auto-sync**: Database schema synchronization in development mode
- **Type Safety**: Full TypeScript support
- **Polygon API Integration**: Real-time stock market data
- **Transaction-Based Portfolio Management**: Immutable audit trail for positions
- **AI Agent System**: LangGraph-based intelligent portfolio analysis with reasoning traces

## API Endpoints

### Portfolio Management

#### GET `/api/portfolios`
- Returns all portfolios for the authenticated user
- Response: `DashboardPortfolio[]`

#### GET `/api/portfolios/:id`
- Returns a specific portfolio with ownership verification
- Response: `Portfolio`

#### GET `/api/portfolios/:id/assets`
- Returns current positions (materialized view calculated from transactions)
- Each asset includes:
  - Current market price from Polygon API (previous close)
  - Market value with fallback to cost basis if price unavailable
  - Profit/Loss calculations
- Response: `EnrichedAssetDto[]`

#### GET `/api/portfolios/:id/summary`
- **Single source of truth for high-level portfolio metrics**
- Returns aggregated portfolio data with:
  - `totalValue`: Sum of all positions (stocks + cash) at market price or cost basis
  - `cashBalance`: Separate cash balance for widgets
  - `totalCostBasis`: Total amount invested
  - `unrealizedPL`: Total unrealized profit/loss
  - `positions`: Array of all positions with market data
- Uses Polygon `getPreviousClose` API for consistent pricing
- **Note**: Both `/assets` and `/summary` use the same Polygon endpoint for data consistency
- Response: `PortfolioSummaryDto`

#### POST `/api/portfolios`
- Creates a new portfolio
- Request: `CreatePortfolioDto { name, description?, riskProfile? }`
- Response: `Portfolio`

#### DELETE `/api/portfolios/:id`
- Deletes a portfolio and all associated transactions/assets

### Transaction Management

#### POST `/api/portfolios/:id/transactions`
- Records a BUY, SELL, DEPOSIT, or WITHDRAWAL transaction
- Automatically recalculates positions (assets table)
- **Automatic Performance Snapshot Backfill**: ALL transactions automatically trigger performance snapshot recalculation to ensure no gaps in data
- **Frontend automatically reloads both assets and summary** for UI consistency
- Request: `CreateTransactionDto { type, ticker, quantity, price, transactionDate? }`
- Response: `TransactionResponseDto`

**Transaction Types:**
- `BUY`: Purchase stock (reduces CASH, increases stock position, creates offsetting CASH transaction)
- `SELL`: Sell stock (increases CASH, reduces stock position, creates offsetting CASH transaction)
- `DEPOSIT`: Add external cash to portfolio (increases CASH only, no offsetting transaction)
- `WITHDRAWAL`: Remove cash from portfolio (decreases CASH only, no offsetting transaction)

**Automatic Backfill Trigger:**

Every transaction (regardless of date) automatically triggers a performance snapshot backfill to ensure complete, gap-free performance data. This happens asynchronously via event emitters and does not block the transaction creation/deletion response.

**Why all transactions?** To avoid gaps in snapshot data. Without automatic backfill on every transaction, new portfolios or recent transactions would have no performance data until manually backfilled.

Example log output:
```
[TransactionsService] Transaction detected for portfolio abc-123 on 2024-01-15T00:00:00.000Z. Auto-triggering performance snapshot backfill from 2024-01-15T00:00:00.000Z.
[DailySnapshotCalculationService] Auto-triggering snapshot backfill for portfolio abc-123 from 2024-01-15
[DailySnapshotCalculationService] Auto-backfill completed successfully for portfolio abc-123
```

#### GET `/api/portfolios/:id/transactions`
- Returns transaction history with optional filters
- Query params: `ticker?`, `type?`, `startDate?`, `endDate?`
- Response: `TransactionResponseDto[]`

#### DELETE `/api/portfolios/:id/transactions/:transactionId`
- Deletes a transaction
- Automatically recalculates positions
- **Automatic Performance Snapshot Backfill**: Automatically triggers performance snapshot recalculation to keep data current
- **Frontend automatically reloads both assets and summary** for UI consistency

### Portfolio Performance Snapshots

The application uses a daily snapshot system with Time-Weighted Return (TWR) methodology for fast, consistent performance metrics. For a detailed technical explanation of the architecture, database schema, and algorithms, see [DAILY_SNAPSHOTS.md](./docs/DAILY_SNAPSHOTS.md).

**Automatic Integration:** When you create, update, or delete ANY transaction, the system automatically triggers a performance snapshot backfill from that date forward. This ensures your performance data always stays accurate without manual intervention and prevents gaps in snapshot data.

#### POST `/api/performance/:portfolioId/admin/backfill`

Recalculates daily performance snapshots for the entire portfolio history. 

**When to Use:**
- Force recalculation if data inconsistencies are detected
- Bulk historical data import (optional - automatic backfill handles single transactions)

**Note:** All transactions automatically trigger backfill, so manual backfill is rarely needed for day-to-day operations.

**Query Parameters:**
- `startDate` (optional) - ISO datetime to start backfill from (defaults to earliest transaction)
- `force` (optional) - Set to `true` to overwrite existing snapshots (default: `false`)

**Response:** `BackfillResponseDto`
```json
{
  "message": "Portfolio snapshots backfilled successfully",
  "daysCalculated": 724,
  "startDate": "2024-01-15",
  "endDate": "2026-01-07"
}
```

**Examples:**

Auto-detect start date:
```bash
curl -X POST "http://localhost:3001/api/performance/{portfolioId}/admin/backfill" \
  -H "Authorization: Bearer {token}"
```

Explicit start date:
```bash
curl -X POST "http://localhost:3001/api/performance/{portfolioId}/admin/backfill?startDate=2024-01-01T00:00:00Z" \
  -H "Authorization: Bearer {token}"
```

Force recalculation:
```bash
curl -X POST "http://localhost:3001/api/performance/{portfolioId}/admin/backfill?force=true" \
  -H "Authorization: Bearer {token}"
```

### Scheduled Market Data Job

The application automatically fetches benchmark prices daily for performance comparison.

**Schedule:** Daily at 6 PM EST (Monday-Friday)  
**Target:** Previous business day's closing prices (market data available next day)

**Configuration:**

Set the `BENCHMARK_TICKERS` environment variable to specify which benchmark tickers to fetch (comma-separated):

```bash
# .env
BENCHMARK_TICKERS=SPY,QQQ,IWM,AGG,GLD
```

If not configured, the job uses these defaults: `SPY`, `QQQ`, `IWM`

**Behavior:**
- Runs automatically via NestJS cron scheduler (`@Cron` decorator)
- Fetches market data from Polygon API
- Stores prices in `market_data_daily` table
- Individual ticker failures don't stop other tickers from being fetched
- Success/failure counts logged for monitoring

**Manual Trigger:**

The scheduled job service also provides a manual trigger method for testing or backfilling:

```typescript
// Via dependency injection in another service/controller
constructor(
  private readonly scheduledMarketDataJobService: ScheduledMarketDataJobService
) {}

// Trigger with default date (yesterday)
await this.scheduledMarketDataJobService.triggerManualFetch();

// Trigger with specific date
await this.scheduledMarketDataJobService.triggerManualFetch(new Date('2024-01-15'));
```

#### GET `/api/performance/:portfolioId/benchmark-comparison`

Returns portfolio performance compared to a benchmark index (e.g., SPY) with context-specific user guidance.

**Query Parameters:**
- `timeframe` (required) - Time period: `1M`, `3M`, `6M`, `1Y`, `YTD`, `ALL_TIME`
- `benchmarkTicker` (optional) - Benchmark symbol (default: `SPY`)

**Response:** `BenchmarkComparisonDto`

**Context-Specific Warnings:**

The API returns intelligent, context-aware warning messages to guide users:

| Scenario | Warning Message | When Shown |
|----------|----------------|------------|
| Empty Portfolio | "No transactions found. Buy your first stock to see performance." | Portfolio has no transactions |
| Partial Data | "Portfolio created {date}. Showing {actual} days instead of {timeframe}." | Requested timeframe exceeds portfolio age |
| New Year Reset | "🎊 Happy New Year! YTD reset on Jan 1. Switch to 'ALL' to see last year's data." | YTD checked in January for portfolio created previous year |
| High Cash Allocation | "Your portfolio is {pct}% cash. Consider buying stocks to see performance." | Portfolio is ≥90% cash |
| Short Timeframe | "Returns shown are for the selected period. Annualized returns may not reflect sustained performance." | Normal case with <90 days |

**Response Metadata:**

```json
{
  "metadata": {
    "startDate": "2025-12-11",
    "endDate": "2026-01-11",
    "dataPoints": 22,
    "isPartialData": false,
    "isEmpty": false,
    "isNewYearReset": false,
    "isCashOnly": false
  }
}
```

#### GET `/api/performance/:portfolioId/history`

Returns time-series data normalized to 100 at start date for chart visualization.

**Query Parameters:**
- `timeframe` (required) - Time period: `1M`, `3M`, `6M`, `1Y`, `YTD`, `ALL`
- `benchmarkTicker` (optional) - Benchmark symbol (default: `SPY`)

**Response:** `HistoricalDataResponseDto`

---

## Agent System (Phase 3)

The backend includes an AI agent system built with LangGraph that provides intelligent portfolio analysis. The system captures detailed reasoning traces for transparency and debugging.

### Automatic Tracing Middleware

The agent system features automatic tracing infrastructure that captures reasoning traces for all nodes without requiring manual integration.

**Architecture:**
- **TracingCallbackHandler**: Automatic tracing via LangChain callbacks
- **withTracing() HOF**: Optional custom reasoning for specific nodes
- **Real-time Streaming**: Token-by-token LLM output (ChatGPT-style UX)
- **Event-Driven**: EventEmitter2 for real-time frontend updates

**Key Benefits:**
- ✅ Fully automatic - new nodes get tracing without code changes
- ✅ Real-time streaming - token-level updates for responsive UX
- ✅ Database persistence - complete traces for historical analysis
- ✅ Production-ready - graceful error handling and logging

**Event Types:**
```typescript
'llm.start'      → { threadId, userId, timestamp }
'llm.token'      → { threadId, userId, token, timestamp }
'llm.complete'   → { threadId, userId, reasoning, timestamp }
'node.complete'  → { threadId, userId, nodeName, timestamp }
```

**Usage Example:**
```typescript
// Option 1: Automatic tracing (no code needed)
export async function observerNode(state: CIOState) {
  return { context: 'Portfolio data retrieved' };
}

// Option 2: Custom reasoning (use withTracing HOF)
export const performanceNode = withTracing('performance_attribution', async (state) => {
  return {
    alpha: -0.06,
    reasoning: 'Portfolio underperformed by 6% vs benchmark due to tech overweight'
  };
});
```

**Implementation Details:** See `backend/docs/LESSONS_LEARNED_TASK_3.1.2.md`

### TracingService

The `TracingService` captures and persists agent reasoning traces to provide transparency into the AI decision-making process.

**Key Features:**
- **Security**: All traces are filtered by `userId` to prevent cross-user data access
- **Persistence**: Traces stored in PostgreSQL with JSONB columns for flexible data
- **Chronological Queries**: Retrieve traces by thread (execution) or user
- **Database Indexes**: Optimized for common query patterns

**Service Methods:**

```typescript
// Record a trace for a node execution
await tracingService.recordTrace(
  threadId: string,
  userId: string,
  nodeName: string,
  input: Record<string, any>,
  output: Record<string, any>,
  reasoning: string
);

// Get all traces for a specific graph execution
const traces = await tracingService.getTracesByThread(threadId, userId);

// Get recent traces for a user (default limit: 100)
const recentTraces = await tracingService.getTracesByUser(userId, limit?);
```

**Database Schema:**

The `reasoning_traces` table includes:
- `id` (UUID) - Primary key
- `threadId` (string) - Graph execution identifier
- `userId` (UUID) - User identifier (security filter)
- `nodeName` (string) - Name of the executed node
- `input` (JSONB) - Node input data
- `output` (JSONB) - Node output data
- `reasoning` (text) - Human-readable explanation
- `createdAt` (timestamp) - Trace creation time

**Indexes:**
- `(threadId, createdAt)` - For retrieving traces by execution
- `(userId, createdAt)` - For retrieving traces by user

---

## Data Architecture

### Transaction-Based System
- **Transactions** are the single source of truth
- **Assets table** is a materialized view (performance cache)
- When a transaction is created/deleted, positions are automatically recalculated
- This ensures data integrity and provides full audit trail

### Market Data Integration
- **Polygon API** integration for real-time stock prices
- **Fallback strategy**: If market data is unavailable or invalid (0, negative), uses cost basis
- **Price validation**: Rejects prices ≤ 0 to ensure data quality
- **Consistent endpoints**: Both `/assets` and `/summary` use `getPreviousClose` for pricing
- **CASH ticker**: Always priced at $1.00, no API call needed

## Project setup

1. Copy the environment template:
```bash
$ cp .env.example .env
```

2. Update the `.env` file with your PostgreSQL credentials (default values work with Docker setup):
```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=stocks_researcher

# Application runs on port 3001 (default port 3000 might be in use)
PORT=3001
NODE_ENV=development

# Polygon API Configuration
# Get your API key from https://polygon.io/
POLYGON_API_KEY=your_polygon_api_key_here
```

3. **Setup PostgreSQL Database**

You have two options:

**Option A: Use existing PostgreSQL container** (if you already have one running)
```bash
# Check if you have a PostgreSQL container running
$ docker ps | grep postgres

# Create the database in your existing container
$ docker exec <container_name> psql -U postgres -c "CREATE DATABASE stocks_researcher;"

# Skip to step 4
```

**Option B: Use the provided Docker Compose** (fresh setup)
```bash
# First, stop any existing PostgreSQL containers on port 5432
$ docker ps | grep postgres
$ docker stop <container_name>

# Then start the new PostgreSQL container
$ docker-compose up -d
```

This will:
- Pull the PostgreSQL 16 Alpine image
- Create and start a PostgreSQL container
- Create the `stocks_researcher` database
- Expose port 5432 on localhost
- Persist data in a Docker volume

4. Install dependencies:
```bash
$ npm install
```

## Database Management

```bash
# Start the database
$ docker-compose up -d

# Stop the database
$ docker-compose down

# Stop and remove all data
$ docker-compose down -v

# View database logs
$ docker-compose logs -f postgres

# Check database status
$ docker-compose ps
```

## pgAdmin (Database GUI)

pgAdmin is a powerful Open Source administration and development platform for PostgreSQL. It provides a web-based graphical interface to:
- **Explore your schema**: View tables, columns, indexes, and relationships.
- **Manage data**: Manually add, edit, or delete rows for testing.
- **Run Queries**: Execute complex SQL queries and view results in a grid.
- **Monitor performance**: View active sessions and database statistics.

**When to use it**: Use pgAdmin during development when you need to verify that data is being saved correctly, to manually seed data, or to troubleshoot database issues without writing code.

### Accessing pgAdmin

- **URL**: [http://localhost:5050](http://localhost:5050)
- **Login Email**: `admin@admin.com`
- **Login Password**: `admin`

### Connecting to the Database in pgAdmin

1. Log in to pgAdmin.
2. Right-click on **Servers** > **Register** > **Server...**.
3. In the **General** tab, give it a name (e.g., `Stocks Researcher`).
4. In the **Connection** tab, use these details:
   - **Host name/address**: `postgres` (this is the service name in docker-compose)
   - **Port**: `5432`
   - **Maintenance database**: `stocks_researcher`
   - **Username**: `postgres`
   - **Password**: `postgres`
5. Click **Save**.

## Compile and run the project

### Recommended Development Mode
This script starts the backend in watch mode and automatically opens pgAdmin in your browser once it's ready.
```bash
$ npm run dev
```

### Other Scripts
```bash
# watch mode only
$ npm run start:dev

# manual pgadmin opener
$ npm run pgadmin

# production mode
$ npm run start:prod
```

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run in watch mode
npm run test:watch

# Generate coverage report
npm run test:cov
```

### E2E (End-to-End) Tests

E2E tests validate complete user workflows using a real PostgreSQL database and real HTTP requests. No mocking of database or core services - tests run against the actual application stack.

#### Quick Start

```bash
# Run all e2e tests
npm run test:e2e

# Run specific test suite
npm run test:e2e -- auth.e2e-spec.ts

# Run multiple suites
npm run test:e2e -- auth.e2e-spec.ts performance.e2e-spec.ts
```

#### Database Setup

E2E tests use a **separate test database** to avoid affecting your development data.

**One-Time Setup:**
```bash
# Create test database
docker exec <postgres-container-name> psql -U postgres -c "CREATE DATABASE stocks_researcher_test;"
```

**Automatic Cleanup:**
- Database is automatically cleaned **before** all tests (global setup)
- Database is automatically cleaned **after** all tests (global teardown)
- Each test suite cleans up in `afterAll` hooks
- No manual cleanup needed between runs ✅

#### Test Configuration

Tests are configured to run **sequentially** (one file at a time) to avoid database connection contention:

```json
{
  "maxWorkers": 1,      // Sequential execution
  "testTimeout": 30000, // 30 second timeout
  "forceExit": true     // Clean process termination
}
```

**Why sequential?** Parallel execution can cause database deadlocks and connection exhaustion when multiple NestJS apps start simultaneously.

#### Environment Variables

Tests automatically use test-specific configuration:

```
NODE_ENV=test
DB_DATABASE=stocks_researcher_test
```

These are set in `test/jest-e2e.setup.ts` and take precedence over `.env` file values.

#### Test Database Patterns

**Business Rules in Tests:**

Tests follow actual user workflows, including business rules:

```typescript
// ✅ Correct: Deposit cash before buying
await createTransaction({ ticker: 'CASH', type: 'DEPOSIT', quantity: 10000, price: 1 });
await createTransaction({ ticker: 'AAPL', type: 'BUY', quantity: 10, price: 150 });

// ❌ Wrong: Buying without cash fails validation
await createTransaction({ ticker: 'AAPL', type: 'BUY', quantity: 10, price: 150 });
// Error: Insufficient cash balance
```

**Data Isolation:**

Each test creates unique data to prevent conflicts:

```typescript
// Use timestamps for unique identifiers
const email = `test-${Date.now()}@example.com`;
```

**Cleanup Strategy:**

```typescript
beforeAll(async () => {
  // Setup: Create test app and database manager
});

afterAll(async () => {
  // Cleanup: Truncate all tables
  await dbManager.truncateAll();
  await app.close();
});
```

#### Common Issues & Solutions

**Issue: Tests timeout on first run**

**Cause:** TypeORM is creating database schema (tables, indexes, FK constraints)

**Solution:** Run tests again - first run initializes schema, subsequent runs are fast
```bash
npm run test:e2e  # May timeout on initial schema creation
npm run test:e2e  # Should pass
```

#### Best Practices

**DO:**
- ✅ Run full suite before committing: `npm run test:e2e`
- ✅ Trust the automated database cleanup
- ✅ Use sequential execution (`maxWorkers: 1`)
- ✅ Test complete user journeys, not just API endpoints
- ✅ Use real database and HTTP (no mocking)

**DON'T:**
- ❌ Manually clean test database (it's automatic)
- ❌ Run tests in parallel (will cause deadlocks)
- ❌ Mock database or core services in e2e tests
- ❌ Share data between test files (use unique IDs)


**Verbose output:**
```bash
npm run test:e2e -- --verbose
```

#### CI/CD Integration

**GitHub Actions / GitLab CI:**
```yaml
- name: Setup Test Database
  run: |
    docker exec postgres-container psql -U postgres -c "CREATE DATABASE stocks_researcher_test;" || true

- name: Run E2E Tests
  run: |
    cd backend
    npm run test:e2e
  env:
    NODE_ENV: test
    DB_DATABASE: stocks_researcher_test
```

**Expected Exit Code:** 0 (success)

#### Test Infrastructure Files

- `test/jest-e2e.json` - Jest configuration for e2e tests
- `test/jest-e2e.setup.ts` - Environment variables and setup
- `test/jest-global-setup.ts` - Clean database before all tests
- `test/jest-global-teardown.ts` - Clean database after all tests
- `test/helpers/test-database-manager.ts` - Database cleanup utilities with deadlock prevention

#### What Tests Validate

**Real Integration:**
- ✅ PostgreSQL database with real queries and transactions
- ✅ TypeORM entity relationships and constraints
- ✅ HTTP requests via supertest
- ✅ JWT authentication and authorization
- ✅ Business logic validation (cash balance, ownership, etc.)
- ✅ Performance calculations with real data
- ✅ AI agent graph execution
- ✅ Server-sent events (SSE) streaming

**Not Tested in E2E:**
- External API calls (Polygon, Gemini) - mocked or skipped
- Email sending - would require test SMTP
- Scheduled jobs - tested via manual triggers

---

### Quick Reference

```bash
# Development
npm run dev                    # Start server + open pgAdmin
npm run test                   # Run unit tests
npm run test:e2e              # Run e2e tests
npm run lint                   # Check code quality
npm run typescript:build       # Verify types

# Before Commit
npm run lint && npm run typescript:build && npm run test:e2e
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
