import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TracingService } from './tracing.service';
import { ReasoningTrace } from '../entities/reasoning-trace.entity';
import { User } from 'src/modules/users/entities/user.entity';

describe('TracingService', () => {
  let service: TracingService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracingService,
        {
          provide: getRepositoryToken(ReasoningTrace),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TracingService>(TracingService);

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
        status: 'completed',
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
        status: 'running',
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
        status: 'running',
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
        status: 'running',
        toolResults: [{ tool: 'FRED API', result: { value: 3.2 } }],
        durationMs: 1234,
        error: undefined,
        stepIndex: 1,
      });
      expect(result.status).toBe('running');
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
      const newStatus = 'completed';

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

    it('should return null if trace not found', async () => {
      // Arrange
      const traceId = 'non-existent';
      mockRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.updateTraceStatus(traceId, 'completed');

      // Assert
      expect(result).toBeNull();
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
        'failed',
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

    it('should return null if trace not found', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.recordTraceDuration('non-existent', 1000);

      // Assert
      expect(result).toBeNull();
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

    it('should return null if trace not found', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.attachToolResults('non-existent', []);

      // Assert
      expect(result).toBeNull();
    });
  });
});
