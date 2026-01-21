import { Injectable, Logger } from '@nestjs/common';
import { HumanMessage } from '@langchain/core/messages';
import { buildCIOGraph } from '../graphs/cio.graph';
import { StateService } from './state.service';
import {
  CompiledGraph,
  GraphExecutionConfig,
  GraphStateWithInterrupt,
  CheckpointState,
} from './types/langgraph.types';
import { CIOState } from '../graphs/types';

/**
 * GraphExecutorService
 *
 * Single Responsibility: Manage LangGraph instance lifecycle and execution
 *
 * Responsibilities:
 * - Graph compilation and lazy initialization
 * - Direct LangGraph API calls (invoke, getState, updateState)
 * - Low-level graph execution primitives
 *
 * WHY separate service:
 * - Encapsulates all LangGraph-specific implementation details
 * - Makes it easy to swap graph implementation if needed
 * - Provides clean abstraction over LangGraph's dynamic API
 */
@Injectable()
export class GraphExecutorService {
  private readonly logger = new Logger(GraphExecutorService.name);
  private graph: CompiledGraph | null = null;

  constructor(private readonly stateService: StateService) {}

  /**
   * Get or lazily initialize the compiled graph
   *
   * @returns Compiled graph instance
   */
  getGraph(): CompiledGraph {
    if (!this.graph) {
      this.logger.debug('Building CIO graph...');
      this.graph = buildCIOGraph(this.stateService) as CompiledGraph;
      this.logger.log('CIO graph built and compiled');
    }
    return this.graph;
  }

  /**
   * Execute graph with initial state
   *
   * @param initialState - Initial graph state
   * @param config - Execution configuration
   * @returns Final graph state
   */
  async invoke(
    initialState: CIOState,
    config: GraphExecutionConfig,
  ): Promise<GraphStateWithInterrupt> {
    const graph = this.getGraph();
    return await graph.invoke(initialState, config);
  }

  /**
   * Resume graph from checkpoint
   *
   * @param config - Execution configuration with thread_id
   * @returns Final graph state
   */
  async resume(config: GraphExecutionConfig): Promise<GraphStateWithInterrupt> {
    const graph = this.getGraph();
    return await graph.invoke(null, config);
  }

  /**
   * Get current checkpoint state
   *
   * @param config - Execution configuration with thread_id
   * @returns Current checkpoint state or null if not found
   */
  async getState(
    config: GraphExecutionConfig,
  ): Promise<CheckpointState | null> {
    const graph = this.getGraph();
    return await graph.getState(config);
  }

  /**
   * Update state at current checkpoint
   *
   * @param config - Execution configuration with thread_id
   * @param values - Partial state updates
   */
  async updateState(
    config: GraphExecutionConfig,
    values: Partial<CIOState>,
  ): Promise<void> {
    const graph = this.getGraph();
    await graph.updateState(config, values);
  }

  /**
   * Add user input message to checkpoint state
   *
   * @param config - Execution configuration
   * @param userInput - User's input message
   */
  async addUserInput(
    config: GraphExecutionConfig,
    userInput: string,
  ): Promise<void> {
    await this.updateState(config, {
      messages: [new HumanMessage(userInput)],
    });
  }
}
