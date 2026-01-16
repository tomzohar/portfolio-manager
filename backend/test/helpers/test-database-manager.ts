import { DataSource } from 'typeorm';

/**
 * Test Database Manager
 *
 * Centralized database cleanup utility for E2E tests.
 * Provides methods to truncate tables while respecting foreign key constraints.
 *
 * Usage:
 * ```typescript
 * const dbManager = new TestDatabaseManager(dataSource);
 * await dbManager.truncateAll(); // Clean all tables
 * ```
 */
export class TestDatabaseManager {
  /**
   * Cleanup order for tables (children first, parents last)
   * This order respects foreign key constraints to avoid FK violations
   */
  private readonly CLEANUP_ORDER = [
    'token_usage',
    'reasoning_traces',
    'portfolio_daily_performance',
    'market_data_daily',
    'checkpoints', // LangGraph checkpoints table
    'transactions',
    'holdings',
    'assets',
    'portfolios',
    'users',
  ];

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Truncate all tables in the database in the correct order
   * Uses TRUNCATE CASCADE for speed and to handle FK constraints
   */
  async truncateAll(): Promise<void> {
    try {
      // Temporarily disable foreign key checks for faster truncation
      await this.dataSource.query('SET CONSTRAINTS ALL DEFERRED;');

      for (const tableName of this.CLEANUP_ORDER) {
        try {
          await this.dataSource.query(
            `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`,
          );
        } catch (error) {
          // Ignore errors for tables that don't exist yet
          // This handles cases where the database is not fully migrated
          if (
            error instanceof Error &&
            !error.message.includes('does not exist')
          ) {
            console.warn(
              `Warning: Failed to truncate table ${tableName}:`,
              error.message,
            );
          }
        }
      }

      // Re-enable foreign key checks
      await this.dataSource.query('SET CONSTRAINTS ALL IMMEDIATE;');
    } catch (error) {
      console.error('Error during database cleanup:', error);
      throw error;
    }
  }

  /**
   * Truncate specific tables by name
   * Useful for selective cleanup in specific test scenarios
   *
   * @param tableNames - Array of table names to truncate
   */
  async truncateTables(tableNames: string[]): Promise<void> {
    try {
      await this.dataSource.query('SET CONSTRAINTS ALL DEFERRED;');

      for (const tableName of tableNames) {
        try {
          await this.dataSource.query(
            `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`,
          );
        } catch (error) {
          if (
            error instanceof Error &&
            !error.message.includes('does not exist')
          ) {
            console.warn(
              `Warning: Failed to truncate table ${tableName}:`,
              error.message,
            );
          }
        }
      }

      await this.dataSource.query('SET CONSTRAINTS ALL IMMEDIATE;');
    } catch (error) {
      console.error('Error during selective table cleanup:', error);
      throw error;
    }
  }

  /**
   * Get list of all table names from entity metadata
   * Useful for debugging or dynamic cleanup scenarios
   */
  getAllTableNames(): string[] {
    return this.dataSource.entityMetadatas.map(
      (metadata) => metadata.tableName,
    );
  }
}
