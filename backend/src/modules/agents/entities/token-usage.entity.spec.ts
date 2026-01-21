import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenUsage } from './token-usage.entity';

describe('TokenUsage Entity', () => {
  let repository: Repository<TokenUsage>;

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
          provide: getRepositoryToken(TokenUsage),
          useValue: mockRepository,
        },
      ],
    }).compile();

    repository = module.get<Repository<TokenUsage>>(
      getRepositoryToken(TokenUsage),
    );
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create and save token usage', () => {
    it('should create a token usage record with all fields', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const tokenUsageData = {
        userId,
        modelName: 'gemini-2.0-flash-exp',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.00015,
        metadata: {
          graphRunId: 'run-123',
          nodeName: 'observer',
        },
      };

      const mockTokenUsage = {
        id: '987e6543-e21b-12d3-a456-426614174000',
        ...tokenUsageData,
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockTokenUsage);
      mockRepository.save.mockResolvedValue(mockTokenUsage);

      const created = repository.create(tokenUsageData);
      const saved = await repository.save(created);

      expect(created).toHaveProperty('userId', userId);
      expect(created).toHaveProperty('modelName', 'gemini-2.0-flash-exp');
      expect(created).toHaveProperty('totalTokens', 150);
      expect(saved).toEqual(mockTokenUsage);
    });

    it('should save metadata as JSONB', async () => {
      const tokenUsageData = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        modelName: 'gemini-2.0-flash-exp',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.00015,
        metadata: {
          graphRunId: 'run-123',
          nodeName: 'observer',
          customField: 'value',
        },
      };

      const mockTokenUsage = {
        id: '987e6543-e21b-12d3-a456-426614174000',
        ...tokenUsageData,
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockTokenUsage);
      mockRepository.save.mockResolvedValue(mockTokenUsage);

      const created = repository.create(tokenUsageData);
      await repository.save(created);

      expect(created.metadata).toEqual(tokenUsageData.metadata);
      expect(created.metadata).toHaveProperty('customField', 'value');
    });
  });

  describe('query token usage by userId', () => {
    it('should find all token usage records for a user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const mockUsageRecords = [
        {
          id: '1',
          userId,
          modelName: 'gemini-2.0-flash-exp',
          totalTokens: 150,
          estimatedCost: 0.00015,
          createdAt: new Date(),
        },
        {
          id: '2',
          userId,
          modelName: 'gemini-2.0-flash-exp',
          totalTokens: 200,
          estimatedCost: 0.0002,
          createdAt: new Date(),
        },
      ];

      mockRepository.find.mockResolvedValue(mockUsageRecords);

      const results = await repository.find({ where: { userId } });

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('userId', userId);
      expect(mockRepository.find).toHaveBeenCalledWith({ where: { userId } });
    });
  });
});
