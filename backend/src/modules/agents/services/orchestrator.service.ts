import { Injectable, Logger } from '@nestjs/common';
import { HumanMessage } from '@langchain/core/messages';
import { buildCIOGraph } from '../graphs/cio.graph';
import { StateService } from './state.service';
import { ToolRegistryService } from './tool-registry.service';
import { CIOState, PortfolioData } from '../graphs/types';

export interface GraphInput {
  message: string;
  portfolio?: PortfolioData;
}

export interface GraphResult {
  threadId: string;
  finalState: CIOState;
  success: boolean;
  error?: string;
}

/**
 * OrchestratorService
 *
 * High-level service for running the CIO graph.
 * Handles:
 * - Graph initialization and compilation
 * - Input preparation and validation
 * - Execution with proper config
 * - Error handling and logging
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  private graph;

  constructor(
    private readonly stateService: StateService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  /**
   * Get or build the compiled graph (lazy initialization)
   */

  private getGraph(): typeof this.graph {
    if (!this.graph) {
      this.logger.debug('Building CIO graph...');

      this.graph = buildCIOGraph(this.stateService);
      this.logger.log('CIO graph built and compiled');
    }

    return this.graph;
  }

  /**
   * Run the CIO graph for a user
   *
   * @param userId - User ID
   * @param input - Graph input data
   * @param threadId - Optional thread ID for resuming conversations
   * @returns Graph execution result
   */
  async runGraph(
    userId: string,
    input: GraphInput,
    threadId?: string,
  ): Promise<GraphResult> {
    // SECURITY: Validate userId is present (Task 5.2 - User-Scoped Validation)
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error(
        'userId is required for all graph executions (security requirement)',
      );
    }

    this.logger.log(`Running graph for user ${userId}`);

    try {
      // Scope threadId with userId for multi-tenancy
      // If threadId is already scoped (contains :), use it as is
      let scopedThreadId: string;
      if (threadId && threadId.includes(':')) {
        // Already scoped from previous request
        scopedThreadId = threadId;
        this.logger.debug(`Using existing scoped thread ID: ${scopedThreadId}`);
      } else {
        // New threadId, needs scoping
        scopedThreadId = this.stateService.scopeThreadId(userId, threadId);
        this.logger.debug(`Created new scoped thread ID: ${scopedThreadId}`);
      }

      // Build initial state
      const initialState: CIOState = {
        userId,
        messages: [new HumanMessage(input.message)],

        portfolio: input.portfolio,
        errors: [],
        iteration: 0,
        maxIterations: 10,
      };

      // Get compiled graph
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const graph = this.getGraph();

      // Configure execution

      const config = {
        configurable: {
          thread_id: scopedThreadId,
        },
        recursionLimit: 25,
      };

      this.logger.debug('Invoking graph...');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const finalState = await graph.invoke(initialState, config);

      this.logger.log('Graph execution completed successfully');

      return {
        threadId: scopedThreadId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        finalState,
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `Graph execution failed for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }

  /**
   * Stream graph execution (Phase 2 feature)
   * Placeholder for future streaming implementation
   */
  async *streamGraph(
    userId: string,
    input: GraphInput,
    threadId?: string,
  ): AsyncGenerator<any, void, unknown> {
    // SECURITY: Validate userId is present (Task 5.2 - User-Scoped Validation)
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error(
        'userId is required for all graph executions (security requirement)',
      );
    }

    this.logger.warn('Streaming not yet implemented (Phase 2)');
    // For Phase 1, just yield the final result
    const result = await this.runGraph(userId, input, threadId);
    yield result;
  }
}
