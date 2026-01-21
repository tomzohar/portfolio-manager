/**
 * TraceStatus Enum
 *
 * Defines the possible execution states for a reasoning trace.
 * Used to track the lifecycle of node execution in the LangGraph workflow.
 */
export enum TraceStatus {
  /** Trace created but node hasn't started execution yet */
  PENDING = 'pending',

  /** Node is currently executing */
  RUNNING = 'running',

  /** Node execution completed successfully */
  COMPLETED = 'completed',

  /** Node execution failed due to an error */
  FAILED = 'failed',

  /** Node execution was interrupted (e.g., HITL gate) */
  INTERRUPTED = 'interrupted',
}

/**
 * Type guard to validate if a string is a valid TraceStatus
 * @param value - String to validate
 * @returns true if value is a valid TraceStatus, false otherwise
 */
export function isValidTraceStatus(value: string): value is TraceStatus {
  return Object.values(TraceStatus).includes(value as TraceStatus);
}
