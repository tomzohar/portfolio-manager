import { DataSource } from 'typeorm';
import { cleanupGlobalApp } from './global-test-context';

/**
 * Jest Global Teardown for E2E Tests
 *
 * Runs once after all test suites complete.
 * Cleans up the global app instance and database.
 */
export default async function globalTeardown() {
  console.log('\n🧹 Test run complete - cleaning up...\n');

  // Close global app instance
  await cleanupGlobalApp();

  // Final database cleanup
  let dataSource: DataSource | null = null;

  try {
    // Create a temporary DataSource connection for cleanup
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
    await dataSource.query('DROP SCHEMA public CASCADE');
    await dataSource.query('CREATE SCHEMA public');

    console.log('✅ Test database cleaned - ready for next run\n');
  } catch (error) {
    // Don't throw - cleanup failure shouldn't break the test run
    if (error instanceof Error) {
      console.warn('⚠️  Database cleanup skipped:', error.message, '\n');
    }
  } finally {
    // Always close the connection
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  }

  console.log('✅ All E2E tests complete\n');
}
