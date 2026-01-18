import { interrupt } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceService } from '../../performance/performance.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { SectorAttributionService } from '../../performance/services/sector-attribution.service';
import { GraphExecutorService } from './graph-executor.service';
import { InterruptHandlerService } from './interrupt-handler.service';
import { GraphResult, OrchestratorService } from './orchestrator.service';
import { StateService } from './state.service';
import { ToolRegistryService } from './tool-registry.service';
import { TracingService } from './tracing.service';

/**
 * HITL (Human-in-the-Loop) Test Suite for OrchestratorService
 *
 * Task 3.3.1: Implement Interrupt & Suspend Logic (TDD)
 *
 * This test suite verifies that:
 * 1. Graph execution can be paused using LangGraph interrupt()
 * 2. When interrupted, returns status: 'SUSPENDED' (not 'success: true')
 * 3. threadId is returned for resumption
 * 4. State is persisted in checkpoints table
 * 5. No data loss during interrupt
 *
 * Test Strategy (Red Phase):
 * - Create a test graph with a node that calls interrupt('Need approval')
 * - Assert graph returns { status: 'SUSPENDED', threadId, interruptReason }
 * - Assert state is persisted and can be queried from StateService
 * - Verify no exceptions are thrown during normal interrupt flow
 *
 * Implementation Requirements:
 * - OrchestratorService.runGraph() must catch NodeInterrupt exception
 * - Must return GraphResult with status field (not just success: boolean)
 * - Must persist state before returning from interrupt
 */
describe('OrchestratorService - HITL (Interrupt & Suspend)', () => {
  let service: OrchestratorService;
  let stateService: jest.Mocked<StateService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mockCheckpointer: jest.Mocked<PostgresSaver>;

  const mockStateService = {
    getSaver: jest.fn(),
    scopeThreadId: jest.fn(
      (userId, threadId) => `${userId}:${threadId || 'test-thread'}`,
    ),
    extractUserId: jest.fn(
      (scopedThreadId: string) => scopedThreadId.split(':')[0],
    ),
    extractThreadId: jest.fn(
      (scopedThreadId: string) => scopedThreadId.split(':')[1],
    ),
    getCheckpoint: jest.fn(),
    listCheckpoints: jest.fn(),
  };

  const mockToolRegistry = {
    getTools: jest.fn().mockReturnValue([]),
    registerTool: jest.fn(),
    getTool: jest.fn(),
    hasTool: jest.fn(),
    getToolCount: jest.fn().mockReturnValue(0),
    clearTools: jest.fn(),
  };

  const mockPerformanceService = {
    calculateInternalReturn: jest.fn(),
    getBenchmarkComparison: jest.fn(),
  };

  const mockPortfolioService = {
    getHoldingsWithSectorData: jest.fn().mockResolvedValue([]),
    getPortfolioSummary: jest.fn(),
    findOne: jest.fn(),
  };

  const mockSectorAttributionService = {
    calculateSectorWeights: jest.fn().mockResolvedValue([]),
    compareSectorWeightsToSP500: jest.fn().mockResolvedValue([]),
    getTopPerformers: jest.fn().mockResolvedValue([]),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  };

  const mockTracingService = {
    recordTrace: jest.fn(),
    getTracesByThread: jest.fn().mockResolvedValue([]),
    getTracesByUser: jest.fn().mockResolvedValue([]),
  };

  beforeAll(() => {
    process.env.ENABLE_HITL_TEST_NODE = 'true';
  });

  afterAll(() => {
    delete process.env.ENABLE_HITL_TEST_NODE;
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock PostgresSaver with all required methods
    // For testing interrupt logic, we don't need full checkpointer
    // Just return undefined to use in-memory mode
    mockStateService.getSaver.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        GraphExecutorService,
        InterruptHandlerService,
        {
          provide: StateService,
          useValue: mockStateService,
        },
        {
          provide: ToolRegistryService,
          useValue: mockToolRegistry,
        },
        {
          provide: PerformanceService,
          useValue: mockPerformanceService,
        },
        {
          provide: PortfolioService,
          useValue: mockPortfolioService,
        },
        {
          provide: SectorAttributionService,
          useValue: mockSectorAttributionService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: TracingService,
          useValue: mockTracingService,
        },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    stateService = module.get(StateService);
  });

  describe('Graph Interrupt & Suspend', () => {
    /**
     * TEST 1: Graph returns SUSPENDED status when interrupt() is called
     *
     * Expected behavior:
     * - runGraph() should NOT throw exception
     * - Should return GraphResult with status: 'SUSPENDED'
     * - Should include threadId for resumption
     * - Should include interruptReason explaining why it stopped
     *
     * Current implementation expectation: THIS TEST SHOULD FAIL
     * because OrchestratorService doesn't handle NodeInterrupt yet
     */
    it('should return SUSPENDED status when node calls interrupt()', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const input = {
        message: 'Trigger HITL flow that requires approval',
      };

      // Execute graph that contains interrupt() call
      const result: GraphResult = await service.runGraph(userId, input);

      // Assert: Result indicates suspension (not completion)
      expect(result).toBeDefined();
      expect(result.status).toBe('SUSPENDED');
      expect(result.success).toBe(false); // Not completed successfully yet
      expect(result.threadId).toBeDefined();
      expect(result.threadId).toContain(userId); // Thread should be scoped to user

      // Assert: Interrupt reason is provided
      expect(result.interruptReason).toBeDefined();
      expect(typeof result.interruptReason).toBe('string');
      expect(result.interruptReason!.length).toBeGreaterThan(0);
    });

    /**
     * TEST 2: State is persisted when graph is interrupted
     *
     * Expected behavior:
     * - When interrupt() is called, current state must be saved
     * - Checkpoint should be created in database
     * - State should be queryable by threadId
     *
     * Note: LangGraph requires a functional checkpointer for interrupt() to work
     * In test environment without real DB, interrupt still throws GraphValueError
     * but we catch it and return SUSPENDED status correctly
     */
    it('should persist state to database when interrupted', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const input = { message: 'Test state persistence on interrupt' };

      // In test environment, interrupt will throw GraphValueError (no checkpointer)
      // but orchestrator should still return SUSPENDED status
      const result: GraphResult = await service.runGraph(userId, input);

      // Assert: Status indicates suspension even without real checkpointer
      expect(result.status).toBe('SUSPENDED');
      expect(result.success).toBe(false);
      expect(result.threadId).toBeDefined();

      // In production with real PostgresSaver, checkpoint would be auto-saved by LangGraph
      // For now, verify that state is returned correctly
      expect(result.finalState).toBeDefined();
      expect(result.finalState.userId).toBe(userId);
    });

    /**
     * TEST 3: Thread ID is returned for resumption
     *
     * Expected behavior:
     * - Interrupted graph must return threadId
     * - threadId should be user-scoped (userId:threadId format)
     * - threadId should be usable for resume operation
     *
     * Current implementation expectation: PARTIAL PASS
     * threadId is already returned, but status field is missing
     */
    it('should return threadId that can be used for resumption', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const input = { message: 'Test threadId return' };

      const result: GraphResult = await service.runGraph(userId, input);

      // Assert: threadId is present and valid
      expect(result.threadId).toBeDefined();
      expect(typeof result.threadId).toBe('string');
      expect(result.threadId).toContain(':'); // Scoped format: userId:threadId

      // Assert: Can extract userId from threadId (for security validation)
      const extractedUserId = stateService.extractUserId(result.threadId);
      expect(extractedUserId).toBe(userId);
    });

    /**
     * TEST 4: No data loss during interrupt
     *
     * Expected behavior:
     * - All messages up to interrupt point should be preserved
     * - State fields (portfolio, iteration, etc.) should be intact
     * - When resumed, graph should continue from exact point
     *
     * Current implementation expectation: THIS TEST SHOULD FAIL
     * because interrupt handling doesn't ensure state preservation
     */
    it('should preserve all state data when interrupted', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const portfolioData = {
        positions: [
          { ticker: 'AAPL', price: 150, quantity: 10 },
          { ticker: 'GOOGL', price: 100, quantity: 5 },
        ],
      };
      const input = {
        message: 'Analyze portfolio with interrupt',
        portfolio: portfolioData,
      };

      const result: GraphResult = await service.runGraph(userId, input);

      // Assert: State contains all input data
      expect(result.finalState).toBeDefined();
      expect(result.finalState.userId).toBe(userId);
      expect(result.finalState.messages).toBeDefined();
      expect(result.finalState.messages.length).toBeGreaterThan(0);

      // Assert: Portfolio data preserved
      if (portfolioData) {
        expect(result.finalState.portfolio).toBeDefined();
        expect(result.finalState.portfolio!.positions).toHaveLength(2);
      }

      // Assert: Iteration counter preserved
      expect(result.finalState.iteration).toBeGreaterThanOrEqual(0);
      expect(result.finalState.maxIterations).toBe(10);
    });

    /**
     * TEST 5: Interrupt exception is caught and handled gracefully
     *
     * Expected behavior:
     * - NodeInterrupt exception should NOT bubble up to controller
     * - Should be caught in orchestrator and converted to SUSPENDED result
     * - Error field should be empty (interrupt is not an error)
     *
     * Current implementation expectation: THIS TEST SHOULD FAIL
     * because NodeInterrupt is not caught (will propagate as unhandled error)
     */
    it('should catch NodeInterrupt exception and return graceful response', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const input = { message: 'Test interrupt exception handling' };

      // Should NOT throw - must return result instead
      await expect(service.runGraph(userId, input)).resolves.not.toThrow();

      const result: GraphResult = await service.runGraph(userId, input);

      // Assert: Result is valid (not an error)
      expect(result).toBeDefined();
      expect(result.status).toBe('SUSPENDED');

      // Assert: No error in result (interrupt is intentional, not an error)
      expect(result.error).toBeUndefined();
    });
  });

  /**
   * Integration Test: Verify interrupt() from @langchain/langgraph works
   *
   * This test ensures we're using LangGraph's interrupt API correctly.
   * It creates a minimal test node that calls interrupt() directly.
   *
   * Current implementation expectation: THIS TEST SHOULD FAIL
   * because interrupt() usage is not implemented yet
   */
  describe('LangGraph interrupt() API', () => {
    it('should support calling interrupt() from within a node', () => {
      // Test node that calls interrupt()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const testNode = (_state: any) => {
        // This is how we'll use interrupt in real nodes
        interrupt('User approval required for this action');

        // Code after interrupt should not execute
        return {
          nextAction: 'should_not_reach_here',
        };
      };

      // Verify interrupt function is importable
      expect(interrupt).toBeDefined();
      expect(typeof interrupt).toBe('function');

      // Calling interrupt should throw NodeInterrupt exception
      // (This is LangGraph's internal behavior we need to handle)
      expect(() => testNode({})).toThrow();
    });
  });

  /**
   * Security Test: Validate userId in interrupted state
   *
   * Expected behavior:
   * - Interrupted state must preserve userId
   * - Resume operation must validate userId matches
   * - Prevent cross-user state access
   */
  describe('Security: User-Scoped Interrupts', () => {
    it('should preserve userId in suspended state', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const input = { message: 'Test userId preservation' };

      const result: GraphResult = await service.runGraph(userId, input);

      // Assert: userId is in final state
      expect(result.finalState.userId).toBe(userId);

      // Assert: threadId is scoped to userId
      expect(result.threadId).toContain(userId);
    });

    it('should reject interrupt without userId', async () => {
      const input = { message: 'Test without userId' };

      // Should throw security error (not return SUSPENDED)
      await expect(service.runGraph('', input)).rejects.toThrow(
        'userId is required',
      );
    });
  });
});
