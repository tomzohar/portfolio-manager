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
import { StateService } from '../services/state.service';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Timeframe } from '../../performance/types/timeframe.types';

/**
 * Define the graph state schema using LangGraph Annotation
 * This ensures proper state merging and type safety
 */
const CIOStateAnnotation = Annotation.Root({
  userId: Annotation<string>,
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
 * Phase 3 "Performance Attribution" graph:
 * START -> (performance_attribution OR observer) -> End -> END
 *
 * @param stateService - StateService for checkpoint persistence
 * @returns Compiled graph ready for execution
 */
export function buildCIOGraph(stateService: StateService) {
  // Create the state graph with routing logic
  const workflow = new StateGraph(CIOStateAnnotation)
    .addNode('observer', observerNode)
    .addNode('performance_attribution', performanceAttributionNode)
    .addNode('end', endNode)
    .addConditionalEdges('__start__', routerNode, {
      performance_attribution: 'performance_attribution',
      observer: 'observer',
    })
    .addEdge('observer', 'end')
    .addEdge('performance_attribution', 'end')
    .addEdge('end', END);

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
