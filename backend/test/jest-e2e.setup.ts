// Set NODE_ENV to test for E2E tests
process.env.NODE_ENV = 'test';

// Set database configuration for tests
// These will override any .env file settings
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USERNAME = process.env.DB_USERNAME || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
process.env.DB_DATABASE = process.env.DB_DATABASE || 'stocks_researcher_test';

// Enable approval gate in production graph
process.env.ENABLE_APPROVAL_GATE = 'true';

// Set approval threshold for testing
process.env.APPROVAL_TRANSACTION_THRESHOLD = '10000';

// Suppress verbose NestJS logs in tests
// This reduces noise from market data warnings, auth errors, etc.
process.env.LOG_LEVEL = 'fatal'; // Only show fatal errors
