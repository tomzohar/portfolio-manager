import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

/**
 * StateService
 *
 * Wrapper around LangGraph's PostgresSaver for checkpoint persistence.
 * Provides:
 * - Lazy initialization of PostgresSaver
 * - Thread ID scoping by userId for multi-tenancy
 * - Helper methods for thread management
 */
@Injectable()
export class StateService {
  private readonly logger = new Logger(StateService.name);
  private saver: PostgresSaver;

  constructor(private readonly configService: ConfigService) {
    try {
      const connectionString = this.buildConnectionString();
      this.saver = PostgresSaver.fromConnString(connectionString);
      this.logger.log('PostgresSaver initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize PostgresSaver: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Build PostgreSQL connection string from environment variables
   */
  private buildConnectionString(): string {
    const host = this.configService.get<string>('DB_HOST');
    const port = this.configService.get<number>('DB_PORT');
    const username = this.configService.get<string>('DB_USERNAME');
    const password = this.configService.get<string>('DB_PASSWORD');
    const database = this.configService.get<string>('DB_DATABASE');

    if (!host || !port || !username || !password || !database) {
      throw new Error(
        'Missing required database configuration for PostgresSaver. ' +
          'Ensure DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, and DB_DATABASE are set.',
      );
    }

    return `postgresql://${username}:${password}@${host}:${port}/${database}`;
  }

  /**
   * Scope threadId with userId for multi-tenancy
   * Format: {userId}:{threadId}
   *
   * @param userId - User ID
   * @param threadId - Thread ID (optional, will generate if not provided)
   * @returns Scoped thread ID
   */
  scopeThreadId(userId: string, threadId?: string): string {
    const actualThreadId = threadId || randomUUID();
    return `${userId}:${actualThreadId}`;
  }

  /**
   * Extract userId from scoped threadId
   *
   * @param scopedThreadId - Scoped thread ID in format {userId}:{threadId}
   * @returns User ID or null if invalid format
   */
  extractUserId(scopedThreadId: string): string | null {
    const parts = scopedThreadId.split(':');
    if (parts.length !== 2) {
      this.logger.warn(`Invalid scoped threadId format: ${scopedThreadId}`);
      return null;
    }
    return parts[0];
  }

  /**
   * Extract original threadId from scoped threadId
   *
   * @param scopedThreadId - Scoped thread ID in format {userId}:{threadId}
   * @returns Thread ID or null if invalid format
   */
  extractThreadId(scopedThreadId: string): string | null {
    const parts = scopedThreadId.split(':');
    if (parts.length !== 2) {
      this.logger.warn(`Invalid scoped threadId format: ${scopedThreadId}`);
      return null;
    }
    return parts[1];
  }

  /**
   * Get the PostgresSaver instance
   *
   * @returns PostgresSaver for graph checkpointing
   * @throws Error if PostgresSaver is not initialized
   */
  getSaver(): PostgresSaver {
    if (!this.saver) {
      throw new Error('PostgresSaver is not initialized');
    }
    return this.saver;
  }

  /**
   * Initialize PostgresSaver database tables
   * Must be called before first use to create checkpoints and checkpoint_writes tables
   *
   * @returns Promise that resolves when tables are created
   */
  async setupTables(): Promise<void> {
    if (!this.saver) {
      throw new Error('PostgresSaver is not initialized');
    }

    this.logger.debug('Setting up PostgresSaver tables...');
    // Call setup method (exists on PostgresSaver but not in BaseCheckpointSaver interface)
    await (this.saver as { setup: () => Promise<void> }).setup();
    this.logger.log('PostgresSaver tables created successfully');
  }

  /**
   * Cleanup method for graceful shutdown
   */
  onModuleDestroy() {
    this.logger.debug('StateService cleanup');
    // PostgresSaver doesn't need explicit cleanup
  }
}
