/**
 * LangGraph Type Definitions
 *
 * WHY: LangGraph's TypeScript types are generic and don't capture runtime behavior.
 * These types bridge the gap between compile-time safety and runtime reality.
 */

import { CIOState } from '../../graphs/types';

/**
 * Interrupt information structure
 * Set by LangGraph when a node calls interrupt()
 */
export interface InterruptInfo {
  value: string;
  resumable?: boolean;
  when?: string;
}

/**
 * Graph state with interrupt capability
 * Extends CIOState with LangGraph's runtime interrupt field
 */
export interface GraphStateWithInterrupt extends CIOState {
  __interrupt__?: InterruptInfo[];
}

/**
 * Checkpoint state structure
 * Returned by graph.getState() - contains execution metadata
 */
export interface CheckpointState {
  values: GraphStateWithInterrupt;
  next?: string[]; // Pending nodes to execute
  config?: {
    configurable: {
      thread_id: string;
      checkpoint_id?: string;
    };
  };
  metadata?: {
    source?: string;
    step?: number;
    writes?: Record<string, unknown>;
  };
  created_at?: string;
  parent_config?: unknown;
}

/**
 * Compiled LangGraph instance
 * Provides type-safe access to graph methods
 */
export interface CompiledGraph {
  /**
   * Execute the graph with initial state
   */
  invoke(
    state: CIOState | null,
    config: GraphExecutionConfig,
  ): Promise<GraphStateWithInterrupt>;

  /**
   * Get current checkpoint state
   */
  getState(config: GraphExecutionConfig): Promise<CheckpointState | null>;

  /**
   * Update state at current checkpoint
   */
  updateState(
    config: GraphExecutionConfig,
    values: Partial<CIOState>,
  ): Promise<void>;

  /**
   * Stream graph execution (future)
   */
  stream?(
    state: CIOState,
    config: GraphExecutionConfig,
  ): AsyncGenerator<GraphStateWithInterrupt>;
}

/**
 * Graph execution configuration
 */
export interface GraphExecutionConfig {
  configurable: {
    thread_id: string;
    [key: string]: unknown; // Allow additional config (e.g., performanceService)
  };
  recursionLimit: number;
  streamMode?: 'values' | 'updates';
  callbacks?: unknown[]; // LangChain callback handlers
  metadata?: {
    portfolioId?: string | null;
    [key: string]: unknown;
  };
}

/**
 * Graph execution error with state preservation
 * LangGraph attaches state to errors for interrupt/resume
 */
export interface GraphExecutionError extends Error {
  name: string;
  message: string;
  state?: CIOState;
}
