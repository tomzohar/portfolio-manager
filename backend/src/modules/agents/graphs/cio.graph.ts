import { StateGraph, END, Annotation, BaseCheckpointSaver } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { observerNode } from './nodes/observer.node';
import { endNode } from './nodes/end.node';
import { StateService } from '../services/state.service';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

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
});

/**
 * Build the CIO Graph
 *
 * Phase 1 "Hello World" graph:
 * START -> Observer -> End -> END
 *
 * @param stateService - StateService for checkpoint persistence
 * @returns Compiled graph ready for execution
 */
export function buildCIOGraph(stateService: StateService) {
  // Create the state graph
  const workflow = new StateGraph(CIOStateAnnotation)
    .addNode('observer', observerNode)
    .addNode('end', endNode)
    .addEdge('__start__', 'observer')
    .addEdge('observer', 'end')
    .addEdge('end', END);

  // Compile with checkpoint saver (if available)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let checkpointer: PostgresSaver;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    checkpointer = stateService.getSaver();
  } catch {
    throw new Error('PostgresSaver is not initialized');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  return workflow.compile({
    checkpointer: checkpointer as BaseCheckpointSaver,
  });
}
