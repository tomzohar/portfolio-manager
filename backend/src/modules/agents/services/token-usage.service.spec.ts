/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TokenUsageService } from './token-usage.service';
import { TokenUsage } from '../entities/token-usage.entity';

describe('TokenUsageService', () => {
  let service: TokenUsageService;
  let repository: jest.Mocked<Repository<TokenUsage>>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenUsageService,
        {
          provide: getRepositoryToken(TokenUsage),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TokenUsageService>(TokenUsageService);
    repository = module.get(getRepositoryToken(TokenUsage));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordUsage', () => {
    it('should save token usage to database', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const usageData = {
        modelName: 'gemini-2.0-flash-exp',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      };

      const mockTokenUsage = {
        id: '987e6543-e21b-12d3-a456-426614174000',
        userId,
        ...usageData,
        estimatedCost: 0.00015,
        metadata: {},
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockTokenUsage as TokenUsage);
      mockRepository.save.mockResolvedValue(mockTokenUsage as TokenUsage);

      const result = await service.recordUsage(userId, usageData);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          modelName: usageData.modelName,
          promptTokens: usageData.promptTokens,
          completionTokens: usageData.completionTokens,
          totalTokens: usageData.totalTokens,
        }),
      );
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockTokenUsage);
    });

    it('should calculate estimated cost for flash model', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const usageData = {
        modelName: 'gemini-2.0-flash-exp',
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      };

      const mockTokenUsage = {
        id: '987e6543-e21b-12d3-a456-426614174000',
        userId,
        ...usageData,
        estimatedCost: 0.0015, // 1500 tokens * $0.001 per 1000
        metadata: {},
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockTokenUsage as TokenUsage);
      mockRepository.save.mockResolvedValue(mockTokenUsage as TokenUsage);

      const result = await service.recordUsage(userId, usageData);

      expect(result.estimatedCost).toBeCloseTo(0.0015, 6);
    });

    it('should calculate estimated cost for pro model', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const usageData = {
        modelName: 'gemini-2.0-pro',
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      };

      const mockTokenUsage = {
        id: '987e6543-e21b-12d3-a456-426614174000',
        userId,
        ...usageData,
        estimatedCost: 0.015, // 1500 tokens * $0.01 per 1000
        metadata: {},
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockTokenUsage as TokenUsage);
      mockRepository.save.mockResolvedValue(mockTokenUsage as TokenUsage);

      const result = await service.recordUsage(userId, usageData);

      expect(result.estimatedCost).toBeCloseTo(0.015, 6);
    });

    it('should include metadata if provided', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const usageData = {
        modelName: 'gemini-2.0-flash-exp',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        metadata: {
          graphRunId: 'run-123',
          nodeName: 'observer',
        },
      };

      const mockTokenUsage = {
        id: '987e6543-e21b-12d3-a456-426614174000',
        userId,
        ...usageData,
        estimatedCost: 0.00015,
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockTokenUsage as TokenUsage);
      mockRepository.save.mockResolvedValue(mockTokenUsage as TokenUsage);

      const result = await service.recordUsage(userId, usageData);

      expect(result.metadata).toEqual(usageData.metadata);
    });
  });

  describe('getUserUsage', () => {
    it('should return all usage for a user without date filter', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const mockUsageRecords = [
        {
          id: '1',
          userId,
          modelName: 'gemini-2.0-flash-exp',
          totalTokens: 150,
          estimatedCost: 0.00015,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          userId,
          modelName: 'gemini-2.0-pro',
          totalTokens: 200,
          estimatedCost: 0.002,
          createdAt: new Date('2024-01-02'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockUsageRecords as TokenUsage[]);

      const results = await service.getUserUsage(userId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      expect(results).toHaveLength(2);
    });

    it('should filter usage by date range', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockUsageRecords = [
        {
          id: '1',
          userId,
          modelName: 'gemini-2.0-flash-exp',
          totalTokens: 150,
          estimatedCost: 0.00015,
          createdAt: new Date('2024-01-15'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockUsageRecords as TokenUsage[]);

      const results = await service.getUserUsage(userId, {
        startDate,
        endDate,
      });

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          userId,
          createdAt: Between(startDate, endDate),
        },
        order: { createdAt: 'DESC' },
      });
      expect(results).toHaveLength(1);
    });
  });

  describe('getTotalCost', () => {
    it('should calculate total cost for a user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0.02500' }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      const total = await service.getTotalCost(userId);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('userId = :userId', {
        userId,
      });
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        'SUM(estimatedCost)',
        'total',
      );
      expect(total).toBe(0.025);
    });

    it('should return 0 if user has no usage', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: null }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      const total = await service.getTotalCost(userId);

      expect(total).toBe(0);
    });
  });
});
