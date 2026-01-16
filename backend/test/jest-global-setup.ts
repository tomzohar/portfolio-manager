import { DataSource } from 'typeorm';
import { TestDatabaseManager } from './helpers/test-database-manager';

/**
 * Jest Global Setup for E2E Tests
 *
 * Runs once before all test suites start.
 * Ensures the database is in a clean state by truncating all tables.
 *
 * This prevents test failures due to leftover data from:
 * - Previous test runs that were interrupted
 * - Manual testing in the test database
 * - Failed test cleanup
 */
export default async function globalSetup() {
  console.log('\n🧹 Setting up test environment - cleaning database...\n');

  let dataSource: DataSource | null = null;

  try {
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

    // Use TestDatabaseManager to truncate all tables
    const dbManager = new TestDatabaseManager(dataSource);
    await dbManager.truncateAll();

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
