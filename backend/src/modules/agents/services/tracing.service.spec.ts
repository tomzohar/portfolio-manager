import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TracingService } from './tracing.service';
import { ReasoningTrace } from '../entities/reasoning-trace.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { TraceStatus } from '../types/trace-status.enum';

describe('TracingService', () => {
  let service: TracingService;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    maximum: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracingService,
        {
          provide: getRepositoryToken(ReasoningTrace),
          useValue: mockRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<TracingService>(TracingService);
    eventEmitter = module.get(EventEmitter2);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordTrace', () => {
    it('should save a trace to database with all required fields', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const nodeName = 'observer';
      const input = { message: 'test input' };
      const output = { result: 'test output' };
      const reasoning = 'This is the reasoning';

      const mockUser = {
        id: 'user-456',
        email: 'test@example.com',
      } as User;

      const expectedTrace: ReasoningTrace = {
        id: 'trace-789',
        threadId,
        userId,
        nodeName,
        input,
        output,
        reasoning,
        createdAt: new Date(),
        user: mockUser,
      };

      mockRepository.create.mockReturnValue(expectedTrace);
      mockRepository.save.mockResolvedValue(expectedTrace);

      // Act
      const result = await service.recordTrace(
        threadId,
        userId,
        nodeName,
        input,
        output,
        reasoning,
      );

      // Assert
      expect(mockRepository.create).toHaveBeenCalledWith({
        threadId,
        userId,
        nodeName,
        input,
        output,
        reasoning,
        status: TraceStatus.COMPLETED,
        toolResults: undefined,
        durationMs: undefined,
        error: undefined,
        stepIndex: undefined,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(expectedTrace);
      expect(result).toEqual(expectedTrace);
    });

    it('should validate userId is present (security requirement)', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = ''; // Empty userId
      const nodeName = 'observer';
      const input = { message: 'test' };
      const output = { result: 'test' };
      const reasoning = 'test reasoning';

      // Act & Assert
      await expect(
        service.recordTrace(
          threadId,
          userId,
          nodeName,
          input,
          output,
          reasoning,
        ),
      ).rejects.toThrow('userId is required for security');
    });

    it('should handle empty input/output as valid JSONB', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const nodeName = 'observer';
      const input = {};
      const output = {};
      const reasoning = 'Empty state';

      const expectedTrace = {
        id: 'trace-789',
        threadId,
        userId,
        nodeName,
        input,
        output,
        reasoning,
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(expectedTrace as ReasoningTrace);
      mockRepository.save.mockResolvedValue(expectedTrace as ReasoningTrace);

      // Act
      const result = await service.recordTrace(
        threadId,
        userId,
        nodeName,
        input,
        output,
        reasoning,
      );

      // Assert
      expect(result).toEqual(expectedTrace);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle database failures gracefully', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const nodeName = 'observer';
      const input = { message: 'test' };
      const output = { result: 'test' };
      const reasoning = 'test reasoning';

      mockRepository.create.mockReturnValue({} as ReasoningTrace);
      mockRepository.save.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert
      await expect(
        service.recordTrace(
          threadId,
          userId,
          nodeName,
          input,
          output,
          reasoning,
        ),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('getTracesByThread', () => {
    it('should retrieve traces in chronological order', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';

      const mockTraces = [
        {
          id: 'trace-1',
          threadId,
          userId,
          nodeName: 'observer',
          input: {},
          output: {},
          reasoning: 'First node',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'trace-2',
          threadId,
          userId,
          nodeName: 'performance_attribution',
          input: {},
          output: {},
          reasoning: 'Second node',
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
        {
          id: 'trace-3',
          threadId,
          userId,
          nodeName: 'end',
          input: {},
          output: {},
          reasoning: 'Final node',
          createdAt: new Date('2024-01-01T10:02:00Z'),
        },
      ] as ReasoningTrace[];

      mockRepository.find.mockResolvedValue(mockTraces);

      // Act
      const result = await service.getTracesByThread(threadId, userId);

      // Assert
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { threadId, userId },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(mockTraces);
      expect(result).toHaveLength(3);
    });

    it('should filter by userId for security', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';

      mockRepository.find.mockResolvedValue([]);

      // Act
      await service.getTracesByThread(threadId, userId);

      // Assert
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { threadId, userId },
        order: { createdAt: 'ASC' },
      });
    });

    it('should return empty array if no traces found', async () => {
      // Arrange
      const threadId = 'thread-nonexistent';
      const userId = 'user-456';

      mockRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getTracesByThread(threadId, userId);

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('getTracesByUser', () => {
    it('should retrieve traces for user with limit', async () => {
      // Arrange
      const userId = 'user-456';
      const limit = 10;

      const mockTraces = Array.from({ length: 10 }, (_, i) => ({
        id: `trace-${i}`,
        threadId: `thread-${i}`,
        userId,
        nodeName: 'observer',
        input: {},
        output: {},
        reasoning: `Trace ${i}`,
        createdAt: new Date(`2024-01-01T10:${String(i).padStart(2, '0')}:00Z`),
      })) as ReasoningTrace[];

      mockRepository.find.mockResolvedValue(mockTraces);

      // Act
      const result = await service.getTracesByUser(userId, limit);

      // Assert
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: limit,
      });
      expect(result).toEqual(mockTraces);
      expect(result).toHaveLength(10);
    });

    it('should use default limit if not provided', async () => {
      // Arrange
      const userId = 'user-456';

      mockRepository.find.mockResolvedValue([]);

      // Act
      await service.getTracesByUser(userId);

      // Assert
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 100, // Default limit
      });
    });

    it('should return traces in descending order (most recent first)', async () => {
      // Arrange
      const userId = 'user-456';
      const limit = 5;

      const mockTraces = [
        {
          id: 'trace-3',
          createdAt: new Date('2024-01-03T10:00:00Z'),
        },
        {
          id: 'trace-2',
          createdAt: new Date('2024-01-02T10:00:00Z'),
        },
        {
          id: 'trace-1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ] as ReasoningTrace[];

      mockRepository.find.mockResolvedValue(mockTraces);

      // Act
      const result = await service.getTracesByUser(userId, limit);

      // Assert
      expect(result[0].id).toBe('trace-3');
      expect(result[1].id).toBe('trace-2');
      expect(result[2].id).toBe('trace-1');
    });
  });

  describe('validation', () => {
    it('should reject recordTrace with null userId', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = null as unknown as string;
      const nodeName = 'observer';
      const input = {};
      const output = {};
      const reasoning = 'test';

      // Act & Assert
      await expect(
        service.recordTrace(
          threadId,
          userId,
          nodeName,
          input,
          output,
          reasoning,
        ),
      ).rejects.toThrow();
    });

    it('should reject recordTrace with undefined userId', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = undefined as unknown as string;
      const nodeName = 'observer';
      const input = {};
      const output = {};
      const reasoning = 'test';

      // Act & Assert
      await expect(
        service.recordTrace(
          threadId,
          userId,
          nodeName,
          input,
          output,
          reasoning,
        ),
      ).rejects.toThrow();
    });

    it('should accept valid JSONB structures in input/output', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const nodeName = 'observer';
      const input = {
        nested: {
          data: 'value',
          array: [1, 2, 3],
        },
      };
      const output = {
        complex: {
          result: true,
          metrics: { score: 0.95 },
        },
      };
      const reasoning = 'Complex data structure';

      const mockUser = {
        id: 'user-456',
        email: 'test@example.com',
      } as User;

      const expectedTrace = {
        id: 'trace-789',
        threadId,
        userId,
        nodeName,
        input,
        output,
        reasoning,
        createdAt: new Date(),
        user: mockUser,
      };

      mockRepository.create.mockReturnValue(expectedTrace);
      mockRepository.save.mockResolvedValue(expectedTrace);

      // Act
      const result = await service.recordTrace(
        threadId,
        userId,
        nodeName,
        input,
        output,
        reasoning,
      );

      // Assert
      expect(result.input).toEqual(input);
      expect(result.output).toEqual(output);
    });
  });

  describe('recordTrace with enhanced fields', () => {
    it('should save trace with status, toolResults, and duration', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const nodeName = 'observer';
      const input = { message: 'test' };
      const output = { result: 'test' };
      const reasoning = 'test reasoning';
      const options = {
        status: TraceStatus.RUNNING,
        toolResults: [{ tool: 'FRED API', result: { value: 3.2 } }],
        durationMs: 1234,
        stepIndex: 1,
      };

      const expectedTrace = {
        id: 'trace-789',
        threadId,
        userId,
        nodeName,
        input,
        output,
        reasoning,
        status: TraceStatus.RUNNING,
        toolResults: [{ tool: 'FRED API', result: { value: 3.2 } }],
        durationMs: 1234,
        stepIndex: 1,
        createdAt: new Date(),
      } as unknown as ReasoningTrace;

      mockRepository.create.mockReturnValue(expectedTrace);
      mockRepository.save.mockResolvedValue(expectedTrace);

      // Act
      const result = await service.recordTrace(
        threadId,
        userId,
        nodeName,
        input,
        output,
        reasoning,
        options,
      );

      // Assert
      expect(mockRepository.create).toHaveBeenCalledWith({
        threadId,
        userId,
        nodeName,
        input,
        output,
        reasoning,
        status: TraceStatus.RUNNING,
        toolResults: [{ tool: 'FRED API', result: { value: 3.2 } }],
        durationMs: 1234,
        error: undefined,
        stepIndex: 1,
      });
      expect(result.status).toBe(TraceStatus.RUNNING);
      expect(result.toolResults).toEqual([
        { tool: 'FRED API', result: { value: 3.2 } },
      ]);
      expect(result.durationMs).toBe(1234);
    });
  });

  describe('updateTraceStatus', () => {
    it('should update trace status successfully', async () => {
      // Arrange
      const traceId = 'trace-123';
      const newStatus = TraceStatus.COMPLETED;

      const mockTrace = {
        id: traceId,
        threadId: 'thread-123',
        userId: 'user-456',
        nodeName: 'observer',
        input: {},
        output: {},
        reasoning: 'test',
        status: 'running',
        createdAt: new Date(),
      } as ReasoningTrace;

      const updatedTrace = {
        ...mockTrace,
        status: 'completed',
      };

      mockRepository.findOne.mockResolvedValue(mockTrace);
      mockRepository.save.mockResolvedValue(updatedTrace);

      // Act
      const result = await service.updateTraceStatus(traceId, newStatus);

      // Assert
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: traceId },
      });
      expect(result?.status).toBe('completed');
    });

    it('should throw NotFoundException if trace not found', async () => {
      // Arrange
      const traceId = 'non-existent';
      mockRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateTraceStatus(traceId, TraceStatus.COMPLETED),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update status and error message when trace fails', async () => {
      // Arrange
      const traceId = 'trace-123';
      const errorMessage = 'API rate limit exceeded';

      const mockTrace = {
        id: traceId,
        status: 'running',
      } as ReasoningTrace;

      const updatedTrace = {
        ...mockTrace,
        status: 'failed',
        error: errorMessage,
      };

      mockRepository.findOne.mockResolvedValue(mockTrace);
      mockRepository.save.mockResolvedValue(updatedTrace);

      // Act
      const result = await service.updateTraceStatus(
        traceId,
        TraceStatus.FAILED,
        errorMessage,
      );

      // Assert
      expect(result?.status).toBe('failed');
      expect(result?.error).toBe(errorMessage);
    });
  });

  describe('recordTraceDuration', () => {
    it('should record duration for a trace', async () => {
      // Arrange
      const traceId = 'trace-123';
      const durationMs = 5432;

      const mockTrace = {
        id: traceId,
        durationMs: undefined,
      } as ReasoningTrace;

      const updatedTrace = {
        ...mockTrace,
        durationMs: 5432,
      };

      mockRepository.findOne.mockResolvedValue(mockTrace);
      mockRepository.save.mockResolvedValue(updatedTrace);

      // Act
      const result = await service.recordTraceDuration(traceId, durationMs);

      // Assert
      expect(result?.durationMs).toBe(5432);
    });

    it('should throw NotFoundException if trace not found', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.recordTraceDuration('non-existent', 1000),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('attachToolResults', () => {
    it('should attach tool results to a trace', async () => {
      // Arrange
      const traceId = 'trace-123';
      const toolResults = [
        { tool: 'FRED API', result: { series: 'CPIAUCSL', value: 3.2 } },
        { tool: 'Polygon', result: { ticker: 'AAPL', price: 150.5 } },
      ];

      const mockTrace = {
        id: traceId,
        toolResults: undefined,
      } as ReasoningTrace;

      const updatedTrace = {
        ...mockTrace,
        toolResults,
      };

      mockRepository.findOne.mockResolvedValue(mockTrace);
      mockRepository.save.mockResolvedValue(updatedTrace);

      // Act
      const result = await service.attachToolResults(traceId, toolResults);

      // Assert
      expect(result?.toolResults).toEqual(toolResults);
      expect(result?.toolResults).toHaveLength(2);
    });

    it('should throw NotFoundException if trace not found', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.attachToolResults('non-existent', []),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================================
  // US-001-BE-T3: Enhanced TracingService Methods
  // ============================================================================

  describe('US-001-BE-T3: updateTraceStatus with EventEmitter2', () => {
    it('should emit SSE event when status is updated', async () => {
      // Arrange
      const traceId = 'trace-123';
      const threadId = 'thread-456';
      const newStatus = TraceStatus.COMPLETED;

      const mockTrace = {
        id: traceId,
        threadId,
        userId: 'user-789',
        status: TraceStatus.RUNNING,
      } as ReasoningTrace;

      const updatedTrace = { ...mockTrace, status: newStatus };

      mockRepository.findOne.mockResolvedValue(mockTrace);
      mockRepository.save.mockResolvedValue(updatedTrace);

      // Act
      await service.updateTraceStatus(traceId, newStatus);

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'trace.status_updated',
        expect.objectContaining({
          traceId,
          threadId,
          status: newStatus,
        }),
      );
    });

    it('should throw NotFoundException if trace not found', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateTraceStatus('non-existent', TraceStatus.COMPLETED),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include error message when status is failed', async () => {
      // Arrange
      const traceId = 'trace-123';
      const errorMessage = 'Network timeout';

      const mockTrace = {
        id: traceId,
        threadId: 'thread-456',
        status: TraceStatus.RUNNING,
      } as ReasoningTrace;

      const updatedTrace = {
        ...mockTrace,
        status: TraceStatus.FAILED,
        error: errorMessage,
      };

      mockRepository.findOne.mockResolvedValue(mockTrace);
      mockRepository.save.mockResolvedValue(updatedTrace);

      // Act
      const result = await service.updateTraceStatus(
        traceId,
        TraceStatus.FAILED,
        errorMessage,
      );

      // Assert
      expect(result?.status).toBe(TraceStatus.FAILED);
      expect(result?.error).toBe(errorMessage);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(eventEmitter.emit).toHaveBeenCalled();
    });
  });

  describe('US-001-BE-T3: recordTraceDuration with validation', () => {
    it('should throw BadRequestException if durationMs is negative', async () => {
      // Arrange
      const traceId = 'trace-123';
      const negativeDuration = -100;

      // Act & Assert
      await expect(
        service.recordTraceDuration(traceId, negativeDuration),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept zero duration', async () => {
      // Arrange
      const traceId = 'trace-123';
      const mockTrace = {
        id: traceId,
        durationMs: undefined,
      } as ReasoningTrace;

      const updatedTrace = { ...mockTrace, durationMs: 0 };

      mockRepository.findOne.mockResolvedValue(mockTrace);
      mockRepository.save.mockResolvedValue(updatedTrace);

      // Act
      const result = await service.recordTraceDuration(traceId, 0);

      // Assert
      expect(result?.durationMs).toBe(0);
    });

    it('should throw NotFoundException if trace not found', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.recordTraceDuration('non-existent', 1000),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('US-001-BE-T3: attachToolResults with validation and SSE', () => {
    it('should emit SSE event when tool results are attached', async () => {
      // Arrange
      const traceId = 'trace-123';
      const threadId = 'thread-456';
      const toolResults = [{ tool: 'FRED', result: { value: 3.2 } }];

      const mockTrace = {
        id: traceId,
        threadId,
        toolResults: undefined,
      } as ReasoningTrace;

      const updatedTrace = { ...mockTrace, toolResults };

      mockRepository.findOne.mockResolvedValue(mockTrace);
      mockRepository.save.mockResolvedValue(updatedTrace);

      // Act
      await service.attachToolResults(traceId, toolResults);

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'trace.tools_executed',
        expect.objectContaining({
          traceId,
          threadId,
          toolCount: 1,
        }),
      );
    });

    it('should validate toolResults is an array', async () => {
      // Arrange
      const traceId = 'trace-123';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const invalidToolResults = 'not an array' as any;

      // Act & Assert
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        service.attachToolResults(traceId, invalidToolResults),
      ).rejects.toThrow(BadRequestException);
    });

    it('should limit tool results array to 100 items', async () => {
      // Arrange
      const traceId = 'trace-123';
      const tooManyResults = Array.from({ length: 150 }, (_, i) => ({
        tool: `tool-${i}`,
        result: { data: 'value' },
      }));

      // Act & Assert
      await expect(
        service.attachToolResults(traceId, tooManyResults),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if trace not found', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.attachToolResults('non-existent', []),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('US-001-BE-T3: startTrace', () => {
    it('should create a trace with status=running and auto-increment stepIndex', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const nodeName = 'macro_analysis';
      const input = { message: 'Analyze AAPL' };

      // Mock max stepIndex query result
      const maxStepIndex = 5;

      mockRepository.createQueryBuilder = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        getRawOne: jest
          .fn()
          .mockResolvedValue({ max: maxStepIndex.toString() }) as any,
      });

      const expectedTrace = {
        id: 'trace-789',
        threadId,
        userId,
        nodeName,
        input,
        output: {},
        reasoning: '',
        status: TraceStatus.RUNNING,
        stepIndex: maxStepIndex + 1,
        createdAt: new Date(),
      } as ReasoningTrace;

      mockRepository.create.mockReturnValue(expectedTrace);
      mockRepository.save.mockResolvedValue(expectedTrace);

      // Act
      const result = await service.startTrace(
        threadId,
        userId,
        nodeName,
        input,
      );

      // Assert
      expect(result.status).toBe(TraceStatus.RUNNING);
      expect(result.stepIndex).toBe(6);
      expect(result.input).toEqual(input);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'node.start',
        expect.objectContaining({
          traceId: expectedTrace.id,
          threadId,
          nodeName,
        }),
      );
    });

    it('should set stepIndex to 0 if no previous traces exist', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const nodeName = 'observer';
      const input = {};

      // Mock max stepIndex query result (no previous traces)

      mockRepository.createQueryBuilder = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        getRawOne: jest.fn().mockResolvedValue({ max: null }) as any,
      });

      const expectedTrace = {
        id: 'trace-first',
        threadId,
        userId,
        nodeName,
        input,
        output: {},
        reasoning: '',
        status: TraceStatus.RUNNING,
        stepIndex: 0,
        createdAt: new Date(),
      } as ReasoningTrace;

      mockRepository.create.mockReturnValue(expectedTrace);
      mockRepository.save.mockResolvedValue(expectedTrace);

      // Act
      const result = await service.startTrace(
        threadId,
        userId,
        nodeName,
        input,
      );

      // Assert
      expect(result.stepIndex).toBe(0);
    });

    it('should validate userId is present', async () => {
      // Act & Assert
      await expect(
        service.startTrace('thread-123', '', 'observer', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('US-001-BE-T3: completeTrace', () => {
    it('should update trace with output, reasoning, duration and status=completed', async () => {
      // Arrange
      const traceId = 'trace-123';
      const threadId = 'thread-456';
      const output = { result: 'Analysis complete' };
      const reasoning = 'Processed market data and identified trends';
      const durationMs = 3450;

      const mockTrace = {
        id: traceId,
        threadId,
        userId: 'user-789',
        nodeName: 'macro_analysis',
        status: TraceStatus.RUNNING,
        output: {},
        reasoning: '',
      } as ReasoningTrace;

      const updatedTrace = {
        ...mockTrace,
        output,
        reasoning,
        durationMs,
        status: TraceStatus.COMPLETED,
      };

      mockRepository.findOne.mockResolvedValue(mockTrace);
      mockRepository.save.mockResolvedValue(updatedTrace);

      // Act
      await service.completeTrace(traceId, output, reasoning, durationMs);

      // Assert
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          output,
          reasoning,
          durationMs,
          status: TraceStatus.COMPLETED,
        }),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'node.complete',
        expect.objectContaining({
          traceId,
          threadId,
          durationMs,
        }),
      );
    });

    it('should throw NotFoundException if trace not found', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.completeTrace('non-existent', {}, 'reasoning', 1000),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate durationMs is not negative', async () => {
      // Arrange
      const traceId = 'trace-123';
      const mockTrace = {
        id: traceId,
        status: TraceStatus.RUNNING,
      } as ReasoningTrace;

      mockRepository.findOne.mockResolvedValue(mockTrace);

      // Act & Assert
      await expect(
        service.completeTrace(traceId, {}, 'reasoning', -500),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
