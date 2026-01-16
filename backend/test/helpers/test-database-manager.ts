import { DataSource } from 'typeorm';

/**
 * Test Database Manager
 *
 * Centralized database cleanup utility for E2E tests.
 * Provides methods to truncate tables while respecting foreign key constraints.
 * Includes deadlock prevention and retry logic for parallel test execution.
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

  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_DELAY_MS = 100;
  private readonly LOCK_TIMEOUT_MS = 5000;

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Truncate all tables in the database in the correct order
   * Uses TRUNCATE CASCADE with deadlock prevention and retry logic
   */
  async truncateAll(): Promise<void> {
    let attempt = 0;
    while (attempt < this.MAX_RETRIES) {
      try {
        return await this.performTruncate();
      } catch (error) {
        if (error instanceof Error && this.isDeadlockError(error)) {
          attempt++;
          if (attempt >= this.MAX_RETRIES) {
            console.error(
              `Database cleanup failed after ${this.MAX_RETRIES} attempts due to deadlock`,
            );
            throw error;
          }
          const delay = this.INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(
            `Deadlock detected during cleanup, retrying in ${delay}ms (attempt ${attempt}/${this.MAX_RETRIES})`,
          );
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Perform the actual truncate operation
   */
  private async performTruncate(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Set lock timeout to fail fast instead of waiting indefinitely
      await queryRunner.query(`SET lock_timeout = '${this.LOCK_TIMEOUT_MS}ms'`);

      // Get list of existing tables to avoid transaction abort
      const existingTablesResult = (await queryRunner.query(`
        SELECT tablename 
        FROM pg_catalog.pg_tables 
        WHERE schemaname = 'public'
      `)) as Array<{ tablename: string }>;

      const existingTables = new Set(
        existingTablesResult.map((row) => row.tablename),
      );

      // Filter cleanup order to only include existing tables
      const tablesToTruncate = this.CLEANUP_ORDER.filter((table) =>
        existingTables.has(table),
      );

      if (tablesToTruncate.length === 0) {
        // No tables to truncate (fresh database)
        return;
      }

      // Use a single transaction to ensure atomicity and prevent deadlocks
      await queryRunner.startTransaction();

      try {
        // Temporarily disable foreign key checks for faster truncation
        await queryRunner.query('SET CONSTRAINTS ALL DEFERRED');

        // Truncate only existing tables
        for (const tableName of tablesToTruncate) {
          await queryRunner.query(
            `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`,
          );
        }

        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      }
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Truncate specific tables by name
   * Useful for selective cleanup in specific test scenarios
   *
   * @param tableNames - Array of table names to truncate
   */
  async truncateTables(tableNames: string[]): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.query(`SET lock_timeout = '${this.LOCK_TIMEOUT_MS}ms'`);

      // Get list of existing tables
      const existingTablesResult = (await queryRunner.query(`
        SELECT tablename 
        FROM pg_catalog.pg_tables 
        WHERE schemaname = 'public'
      `)) as Array<{ tablename: string }>;

      const existingTables = new Set(
        existingTablesResult.map((row) => row.tablename),
      );

      // Filter to only include existing tables
      const tablesToTruncate = tableNames.filter((table) =>
        existingTables.has(table),
      );

      if (tablesToTruncate.length === 0) {
        return;
      }

      await queryRunner.startTransaction();

      try {
        await queryRunner.query('SET CONSTRAINTS ALL DEFERRED');

        for (const tableName of tablesToTruncate) {
          await queryRunner.query(
            `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`,
          );
        }

        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      }
    } finally {
      await queryRunner.release();
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

  /**
   * Check if an error is a deadlock error
   */
  private isDeadlockError(error: Error): boolean {
    return (
      error.message.includes('deadlock detected') ||
      error.message.includes('lock timeout') ||
      error.message.includes('could not obtain lock')
    );
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
