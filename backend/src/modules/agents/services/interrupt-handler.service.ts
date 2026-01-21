import { Injectable, Logger } from '@nestjs/common';
import {
  GraphStateWithInterrupt,
  CheckpointState,
  GraphExecutionError,
} from './types/langgraph.types';
import { CIOState } from '../graphs/types';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_INTERRUPT_REASON = 'Graph execution paused for user input';
const CHECKPOINT_MISSING_REASON =
  'This action requires human approval. Please review and confirm to continue.';

// ============================================================================
// Types
// ============================================================================

export interface SuspendedResult {
  threadId: string;
  finalState: CIOState;
  success: false;
  status: 'SUSPENDED';
  interruptReason: string;
}

/**
 * InterruptHandlerService
 *
 * Single Responsibility: Manage graph execution interruptions for HITL flows
 *
 * Responsibilities:
 * - Detect when graph execution is interrupted
 * - Validate thread suspension state
 * - Extract interrupt reasons from errors
 * - Build suspended result objects
 *
 * WHY separate service:
 * - Interrupt logic is complex and domain-specific
 * - Enables testing interrupt detection independently
 * - Makes orchestrator service focus on workflow coordination
 */
@Injectable()
export class InterruptHandlerService {
  private readonly logger = new Logger(InterruptHandlerService.name);

  /**
   * Check if graph execution was interrupted
   *
   * @param state - Final graph state
   * @param threadId - Scoped thread ID
   * @returns Suspended result if interrupted, null otherwise
   */
  checkForInterrupt(
    state: GraphStateWithInterrupt,
    threadId: string,
  ): SuspendedResult | null {
    if (!state.__interrupt__ || state.__interrupt__.length === 0) {
      return null;
    }

    this.logger.log(`Graph interrupted for HITL (thread: ${threadId})`);

    const interruptInfo = state.__interrupt__[0];
    const reason = interruptInfo.value || DEFAULT_INTERRUPT_REASON;

    return this.buildSuspendedResult(state, threadId, reason);
  }

  /**
   * Check if thread is in suspended state
   *
   * @param state - Current checkpoint state
   * @returns True if thread is suspended (has pending work or interrupt)
   */
  isThreadSuspended(state: CheckpointState): boolean {
    const hasNext = !!(state.next && state.next.length > 0);
    const hasInterrupt = !!(
      state.values.__interrupt__ && state.values.__interrupt__.length > 0
    );

    return hasNext || hasInterrupt;
  }

  /**
   * Check if error is an interrupt-related error
   *
   * @param error - Error object
   * @returns True if error indicates an interrupt occurred
   */
  isInterruptError(error: GraphExecutionError): boolean {
    if (error?.name === 'NodeInterrupt' || error?.name === 'GraphValueError') {
      return true;
    }

    if (error?.message) {
      return (
        error.message.includes('NodeInterrupt') ||
        error.message.includes('No checkpointer set')
      );
    }

    return false;
  }

  /**
   * Extract interrupt reason from error
   *
   * @param error - Error object
   * @returns Human-readable interrupt reason
   */
  getInterruptReason(error: GraphExecutionError): string {
    if (!error.message || typeof error.message !== 'string') {
      return DEFAULT_INTERRUPT_REASON;
    }

    if (error.message.includes('No checkpointer set')) {
      return CHECKPOINT_MISSING_REASON;
    }

    return error.message;
  }

  /**
   * Build suspended graph result
   *
   * @param state - Current graph state
   * @param threadId - Scoped thread ID
   * @param reason - Interrupt reason
   * @returns Suspended result object
   */
  buildSuspendedResult(
    state: CIOState,
    threadId: string,
    reason: string,
  ): SuspendedResult {
    return {
      threadId,
      finalState: state,
      success: false,
      status: 'SUSPENDED',
      interruptReason: reason,
    };
  }
}
