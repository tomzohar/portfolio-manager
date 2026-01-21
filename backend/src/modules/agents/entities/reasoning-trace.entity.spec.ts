import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReasoningTrace } from './reasoning-trace.entity';

describe('ReasoningTrace Entity', () => {
  let repository: Repository<ReasoningTrace>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(ReasoningTrace),
          useValue: mockRepository,
        },
      ],
    }).compile();

    repository = module.get<Repository<ReasoningTrace>>(
      getRepositoryToken(ReasoningTrace),
    );
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create and save reasoning trace', () => {
    it('should create a reasoning trace with all fields', async () => {
      const threadId = 'thread-123';
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const traceData = {
        threadId,
        userId,
        nodeName: 'observer',
        input: { portfolio: 'data' },
        output: { nextAction: 'analyze' },
        reasoning:
          'The portfolio needs analysis based on current market conditions.',
      };

      const mockTrace = {
        id: '987e6543-e21b-12d3-a456-426614174000',
        ...traceData,
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockTrace);
      mockRepository.save.mockResolvedValue(mockTrace);

      const created = repository.create(traceData);
      const saved = await repository.save(created);

      expect(created).toHaveProperty('threadId', threadId);
      expect(created).toHaveProperty('nodeName', 'observer');
      expect(created).toHaveProperty('reasoning');
      expect(saved).toEqual(mockTrace);
    });

    it('should store input and output as JSONB', async () => {
      const traceData = {
        threadId: 'thread-123',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        nodeName: 'synthesis',
        input: {
          macroAnalysis: { regime: 'bull' },
          fundamentalAnalysis: { score: 85 },
        },
        output: {
          recommendation: 'buy',
          confidence: 0.85,
        },
        reasoning: 'Strong fundamentals align with bullish macro regime.',
      };

      const mockTrace = {
        id: '987e6543-e21b-12d3-a456-426614174000',
        ...traceData,
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockTrace);
      mockRepository.save.mockResolvedValue(mockTrace);

      const created = repository.create(traceData);
      await repository.save(created);

      expect(created.input).toEqual(traceData.input);
      expect(created.output).toEqual(traceData.output);
      expect(created.input).toHaveProperty('macroAnalysis');
    });
  });

  describe('query reasoning traces by threadId', () => {
    it('should find all traces for a thread', async () => {
      const threadId = 'thread-123';
      const mockTraces = [
        {
          id: '1',
          threadId,
          userId: '123e4567-e89b-12d3-a456-426614174000',
          nodeName: 'observer',
          input: {},
          output: {},
          reasoning: 'Initial observation',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: '2',
          threadId,
          userId: '123e4567-e89b-12d3-a456-426614174000',
          nodeName: 'synthesis',
          input: {},
          output: {},
          reasoning: 'Synthesis step',
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockTraces);

      const results = await repository.find({
        where: { threadId },
        order: { createdAt: 'ASC' },
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('nodeName', 'observer');
      expect(results[1]).toHaveProperty('nodeName', 'synthesis');
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { threadId },
        order: { createdAt: 'ASC' },
      });
    });

    it('should find traces by userId', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTraces = [
        {
          id: '1',
          threadId: 'thread-1',
          userId,
          nodeName: 'observer',
          input: {},
          output: {},
          reasoning: 'Trace 1',
          createdAt: new Date(),
        },
        {
          id: '2',
          threadId: 'thread-2',
          userId,
          nodeName: 'observer',
          input: {},
          output: {},
          reasoning: 'Trace 2',
          createdAt: new Date(),
        },
      ];

      mockRepository.find.mockResolvedValue(mockTraces);

      const results = await repository.find({ where: { userId } });

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('userId', userId);
      expect(mockRepository.find).toHaveBeenCalledWith({ where: { userId } });
    });
  });
});
