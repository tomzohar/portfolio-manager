import {
  StateGraph,
  END,
  Annotation,
  BaseCheckpointSaver,
} from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { endNode } from './nodes/end.node';
import {
  routerNode,
  reasoningRouter,
  toolExecutionRouter,
} from './nodes/router.node';
import { performanceAttributionNode } from './nodes/performance-attribution.node';
import { hitlTestNode } from './nodes/hitl-test.node';
import { approvalGateNode } from './nodes/approval-gate.node';
import { guardrailNode } from './nodes/guardrail.node';
import { reasoningNode } from './nodes/reasoning.node';
import { toolExecutionNode } from './nodes/tool-execution.node';
import { summarizationNode } from './nodes/summarization.node'; // Added
import { StateService } from '../services/state.service';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Timeframe } from '../../performance/types/timeframe.types';

/**
 * Define the graph state schema using LangGraph Annotation
 * This ensures proper state merging and type safety
 */
const CIOStateAnnotation = Annotation.Root({
  userId: Annotation<string>,
  threadId: Annotation<string>,
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
  }),
  portfolio: Annotation<any>,
  nextAction: Annotation<string>,
  final_report: Annotation<string>,
  errors: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
  }),
  iteration: Annotation<number>,
  maxIterations: Annotation<number>,
  performanceAnalysis: Annotation<{
    timeframe?: Timeframe;
    portfolioReturn?: number;
    benchmarkReturn?: number;
    alpha?: number;
    needsTimeframeInput?: boolean;
  }>,
});

/**
 * Build the CIO Graph
 * ...
 */
export function buildCIOGraph(stateService: StateService) {
  const enableHitlTest = process.env.ENABLE_HITL_TEST_NODE === 'true';
  const enableApprovalGate = process.env.ENABLE_APPROVAL_GATE === 'true';

  // Create the state graph with routing logic
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
  let workflow = new StateGraph(CIOStateAnnotation)
    .addNode('guardrail', guardrailNode)
    .addNode('summarization', summarizationNode) // Add summarization node
    .addNode('reasoning', reasoningNode)
    .addNode('tool_execution', toolExecutionNode)
    .addNode('performance_attribution', performanceAttributionNode) as any;

  // Add approval gate node if enabled (production HITL)
  if (enableApprovalGate) {
    workflow = workflow.addNode('approval_gate', approvalGateNode);
  }

  // Add HITL test node only if enabled (testing only)
  if (enableHitlTest) {
    workflow = workflow.addNode('hitl_test', hitlTestNode);
  }

  workflow = workflow
    .addNode('end', endNode)
    .addEdge('__start__', 'guardrail')
    .addEdge('guardrail', 'summarization') // Guardrail -> Summarization
    .addConditionalEdges('summarization', routerNode, {
      // Summarization -> Router
      performance_attribution: 'performance_attribution',
      reasoning: 'reasoning',
      tool_execution: 'tool_execution',
      end: 'end',
      ...(enableApprovalGate ? { approval_gate: 'approval_gate' } : {}),
      ...(enableHitlTest ? { hitl_test: 'hitl_test' } : {}),
    })
    .addConditionalEdges('reasoning', reasoningRouter, {
      tool_execution: 'tool_execution',
      end: 'end',
    })
    .addConditionalEdges('tool_execution', toolExecutionRouter, {
      reasoning: 'reasoning',
      end: 'end',
    })
    .addEdge('performance_attribution', 'end'); // Fix: performance_attribution -> end

  // Add edge for approval gate node only if enabled
  if (enableApprovalGate) {
    workflow = workflow.addEdge('approval_gate', 'end');
  }

  // Add edge for HITL test node only if enabled
  if (enableHitlTest) {
    workflow = workflow.addEdge('hitl_test', 'end');
  }

  workflow = workflow.addEdge('end', END);

  // Compile with checkpoint saver (if available)

  let checkpointer: PostgresSaver | undefined;
  try {
    checkpointer = stateService.getSaver();
  } catch {
    // PostgresSaver not available (e.g., in tests without DB)
    checkpointer = undefined;
  }

  if (!checkpointer) {
    return workflow.compile();
  }
  return workflow.compile({
    checkpointer: checkpointer as BaseCheckpointSaver | undefined,
  });
}
