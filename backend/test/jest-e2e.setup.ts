import { applyE2eDbEnv } from './e2e-env';

// Set NODE_ENV to test for E2E tests
process.env.NODE_ENV = 'test';

// Force database configuration for tests
// These will override any .env file settings
applyE2eDbEnv();

// Enable approval gate in production graph
process.env.ENABLE_APPROVAL_GATE = 'true';

// Set approval threshold for testing
process.env.APPROVAL_TRANSACTION_THRESHOLD = '10000';

// Suppress verbose NestJS logs in tests
// This reduces noise from market data warnings, auth errors, etc.
process.env.LOG_LEVEL = 'fatal'; // Only show fatal errors
