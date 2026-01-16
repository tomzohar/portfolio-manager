import {
  StateGraph,
  END,
  Annotation,
  BaseCheckpointSaver,
} from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { observerNode } from './nodes/observer.node';
import { endNode } from './nodes/end.node';
import { routerNode } from './nodes/router.node';
import { performanceAttributionNode } from './nodes/performance-attribution.node';
import { hitlTestNode } from './nodes/hitl-test.node';
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
 *
 * Phase 3 graph with HITL test support (guarded by ENABLE_HITL_TEST_NODE):
 * START -> (hitl_test OR performance_attribution OR observer) -> End -> END
 *
 * @param stateService - StateService for checkpoint persistence
 * @returns Compiled graph ready for execution
 */
export function buildCIOGraph(stateService: StateService) {
  const enableHitlTest = process.env.ENABLE_HITL_TEST_NODE === 'true';

  // Create the state graph with routing logic
  // Use any for workflow construction to handle conditional nodes/edges
  // while maintaining the complex generic types of StateGraph
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
  let workflow = new StateGraph(CIOStateAnnotation)
    .addNode('observer', observerNode)
    .addNode('performance_attribution', performanceAttributionNode) as any;

  // Add HITL test node only if enabled
  if (enableHitlTest) {
    workflow = workflow.addNode('hitl_test', hitlTestNode);
  }

  workflow = workflow
    .addNode('end', endNode)
    .addConditionalEdges('__start__', routerNode, {
      performance_attribution: 'performance_attribution',
      observer: 'observer',
      ...(enableHitlTest ? { hitl_test: 'hitl_test' } : {}),
    })
    .addEdge('observer', 'end')
    .addEdge('performance_attribution', 'end');

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
