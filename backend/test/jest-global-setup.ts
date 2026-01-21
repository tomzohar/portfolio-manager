import { DataSource } from 'typeorm';
import { applyE2eDbEnv } from './e2e-env';

/**
 * Jest Global Setup for E2E Tests
 *
 * Runs once before all test suites start.
 * Drops and recreates the database schema to ensure a clean state.
 *
 * This prevents test failures due to:
 * - Previous test runs that were interrupted
 * - Manual testing in the test database
 * - Entity schema changes (e.g., foreign key updates)
 * - Failed test cleanup
 */
export default async function globalSetup() {
  console.log('\n🧹 Setting up test environment - cleaning database...\n');

  let dataSource: DataSource | null = null;

  try {
    applyE2eDbEnv();

    // Create a temporary DataSource connection for setup
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'stocks_researcher_test',
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();

    // Drop and recreate the public schema for a completely clean slate
    // This ensures entity changes (like foreign key updates) are properly applied
    await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
    await dataSource.query('CREATE SCHEMA public');

    console.log('✅ Database cleaned successfully\n');
  } catch (error) {
    // Don't throw - allow tests to run even if cleanup fails
    // This handles cases where:
    // - Database doesn't exist yet
    // - Tables haven't been created yet
    // - Connection issues
    if (error instanceof Error) {
      if (error.message.includes('does not exist')) {
        console.log('⚠️  Test database not found - tests will create it\n');
      } else {
        console.warn('⚠️  Database cleanup skipped:', error.message, '\n');
      }
    }
  } finally {
    // Always close the connection
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  }
}
