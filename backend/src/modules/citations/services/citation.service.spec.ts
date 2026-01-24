import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CitationService } from './citation.service';
import { DataCitation } from '../entities/data-citation.entity';
import { CitationSourceType } from '../types/citation-source-type.enum';
import type { ToolResultData } from '../types/tool-result-data.interface';
import { StateService } from '../../agents/services/state.service';

describe('CitationService', () => {
  let service: CitationService;
  let stateService: jest.Mocked<StateService>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockStateService = {
    extractUserId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CitationService,
        {
          provide: getRepositoryToken(DataCitation),
          useValue: mockRepository,
        },
        {
          provide: StateService,
          useValue: mockStateService,
        },
      ],
    }).compile();

    service = module.get<CitationService>(CitationService);
    stateService = module.get(StateService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractCitations', () => {
    it('should extract citations for exact number matches', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'The inflation rate is 3.2 percent';
      const toolResults = [
        {
          tool: 'FRED',
          result: {
            series_id: 'CPIAUCSL',
            value: 3.2,
            date: '2024-01-01',
          },
        },
      ];

      const mockCitation = {
        id: 'citation-1',
        threadId,
        userId,
        reasoningTraceId: null,
        sourceType: CitationSourceType.FRED,
        sourceIdentifier: 'CPIAUCSL',
        dataPoint: toolResults[0].result,
        citationText: 'Source: FRED CPIAUCSL',
        positionInText: 22,
        createdAt: new Date(),
      } as unknown as DataCitation;

      mockRepository.create.mockReturnValue(mockCitation);
      mockRepository.save.mockResolvedValue(mockCitation);

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].sourceType).toBe(CitationSourceType.FRED);
      expect(result[0].sourceIdentifier).toBe('CPIAUCSL');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should match numbers within 5% tolerance', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'Stock price is approximately 103';
      const toolResults = [
        {
          tool: 'Polygon',
          result: {
            ticker: 'AAPL',
            close: 100, // 3% difference from 103
          },
        },
      ];

      const mockCitation = {
        id: 'citation-1',
        sourceType: CitationSourceType.POLYGON,
      } as DataCitation;

      mockRepository.create.mockReturnValue(mockCitation);
      mockRepository.save.mockResolvedValue(mockCitation);

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should skip numbers with no matching tool results', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'The number is 999 which has no source';
      const toolResults = [
        {
          tool: 'FRED',
          result: {
            value: 3.2, // Does not match 999
          },
        },
      ];

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert
      expect(result).toHaveLength(0);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle special number formats (K, M, B suffixes)', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'Market cap is 2.8M';
      const toolResults = [
        {
          tool: 'FMP',
          result: {
            symbol: 'AAPL',
            market_cap: 2800000, // 2.8M normalized
          },
        },
      ];

      const mockCitation = {
        id: 'citation-1',
        sourceType: CitationSourceType.FMP,
      } as DataCitation;

      mockRepository.create.mockReturnValue(mockCitation);
      mockRepository.save.mockResolvedValue(mockCitation);

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert
      expect(result).toHaveLength(1);
    });

    it('should handle percentage formats', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'Growth rate is 23%';
      const toolResults = [
        {
          tool: 'FMP',
          result: {
            growth_rate: 23,
          },
        },
      ];

      const mockCitation = {
        id: 'citation-1',
      } as DataCitation;

      mockRepository.create.mockReturnValue(mockCitation);
      mockRepository.save.mockResolvedValue(mockCitation);

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert
      expect(result).toHaveLength(1);
    });

    it('should create separate citations for duplicate numbers', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'AAPL at 150 and GOOGL at 150';
      const toolResults = [
        {
          tool: 'Polygon',
          result: {
            ticker: 'AAPL',
            close: 150,
          },
        },
        {
          tool: 'Polygon',
          result: {
            ticker: 'GOOGL',
            close: 150,
          },
        },
      ];

      const mockCitation1 = { id: 'citation-1' } as DataCitation;
      const mockCitation2 = { id: 'citation-2' } as DataCitation;

      mockRepository.create.mockReturnValueOnce(mockCitation1);
      mockRepository.create.mockReturnValueOnce(mockCitation2);
      mockRepository.save.mockResolvedValueOnce(mockCitation1);
      mockRepository.save.mockResolvedValueOnce(mockCitation2);

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should truncate large tool result data', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'The value is 100';
      const largeData = {
        value: 100,
        huge_array: Array.from({ length: 50000 }, () => 'x'.repeat(100)),
      };
      const toolResults = [
        {
          tool: 'FRED',
          result: largeData,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mockCitation = {
        id: 'citation-1',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        dataPoint: expect.objectContaining({ _truncated: true }),
      } as any;

      mockRepository.create.mockReturnValue(mockCitation);
      mockRepository.save.mockResolvedValue(mockCitation);

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert
      expect(result).toHaveLength(1);
    });

    it('should handle extraction errors gracefully', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'The value is 3.2';
      const toolResults = [
        {
          tool: 'FRED',
          result: { value: 3.2 },
        },
      ];

      mockRepository.create.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert - Should return empty array on error, not throw
      expect(result).toEqual([]);
    });

    it('should handle empty tool results', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'The value is 3.2';
      const toolResults: ToolResultData[] = [];

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert
      expect(result).toEqual([]);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle text with no numbers', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'No numbers in this text';
      const toolResults = [
        {
          tool: 'FRED',
          result: { value: 3.2 },
        },
      ];

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getCitationsByThread', () => {
    it('should retrieve citations for valid thread ownership', async () => {
      // Arrange
      const threadId = 'thread-user123-abc';
      const userId = 'user-123';

      mockStateService.extractUserId.mockReturnValue('user-123');

      const mockCitations = [
        {
          id: 'citation-1',
          threadId,
          userId,
          sourceType: CitationSourceType.FRED,
          positionInText: 10,
        },
        {
          id: 'citation-2',
          threadId,
          userId,
          sourceType: CitationSourceType.POLYGON,
          positionInText: 50,
        },
      ] as DataCitation[];

      mockRepository.find.mockResolvedValue(mockCitations);

      // Act
      const result = await service.getCitationsByThread(threadId, userId);

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(stateService.extractUserId).toHaveBeenCalledWith(threadId);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { threadId, userId },
        order: { positionInText: 'ASC' },
      });
      expect(result).toEqual(mockCitations);
    });

    it('should throw ForbiddenException if user does not own thread', async () => {
      // Arrange
      const threadId = 'thread-user999-abc';
      const userId = 'user-123';

      mockStateService.extractUserId.mockReturnValue('user-999'); // Different user

      // Act & Assert
      await expect(
        service.getCitationsByThread(threadId, userId),
      ).rejects.toThrow(ForbiddenException);

      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('should return empty array if no citations exist', async () => {
      // Arrange
      const threadId = 'thread-user123-abc';
      const userId = 'user-123';

      mockStateService.extractUserId.mockReturnValue('user-123');
      mockRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getCitationsByThread(threadId, userId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should order citations by position_in_text', async () => {
      // Arrange
      const threadId = 'thread-user123-abc';
      const userId = 'user-123';

      mockStateService.extractUserId.mockReturnValue('user-123');
      mockRepository.find.mockResolvedValue([]);

      // Act
      await service.getCitationsByThread(threadId, userId);

      // Assert
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { threadId, userId },
        order: { positionInText: 'ASC' },
      });
    });
  });

  describe('getCitationData', () => {
    it('should retrieve citation data for authorized user', async () => {
      // Arrange
      const citationId = 'citation-123';
      const userId = 'user-456';

      const mockCitation = {
        id: citationId,
        userId,
        threadId: 'thread-789',
        reasoningTraceId: null,
        positionInText: 0,
        sourceType: CitationSourceType.FRED,
        sourceIdentifier: 'CPIAUCSL',
        dataPoint: { value: 3.2, date: '2024-01-01' },
        citationText: 'FRED: CPIAUCSL',
        createdAt: new Date('2024-01-15'),
      } as unknown as DataCitation;

      mockRepository.findOne.mockResolvedValue(mockCitation);

      // Act
      const result = await service.getCitationData(citationId, userId);

      // Assert
      expect(result).toMatchObject({
        id: citationId,
        sourceType: CitationSourceType.FRED,
        sourceIdentifier: 'CPIAUCSL',
        dataPoint: { value: 3.2, date: '2024-01-01' },
        citationText: 'FRED: CPIAUCSL',
      });
      expect(result.metadata).toBeDefined();
      expect(result.metadata.retrievedAt).toEqual(mockCitation.createdAt);
    });

    it('should throw ForbiddenException if user does not own citation', async () => {
      // Arrange
      const citationId = 'citation-123';
      const userId = 'user-456';

      const mockCitation = {
        id: citationId,
        userId: 'user-999', // Different user
        threadId: 'thread-789',
      } as DataCitation;

      mockRepository.findOne.mockResolvedValue(mockCitation);

      // Act & Assert
      await expect(service.getCitationData(citationId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if citation does not exist', async () => {
      // Arrange
      const citationId = 'non-existent';
      const userId = 'user-456';

      mockRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getCitationData(citationId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include relations when fetching citation', async () => {
      // Arrange
      const citationId = 'citation-123';
      const userId = 'user-456';

      mockRepository.findOne.mockResolvedValue({
        id: citationId,
        userId,
      } as DataCitation);

      // Act
      await service.getCitationData(citationId, userId);

      // Assert
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: citationId },
        relations: ['reasoningTrace'],
      });
    });
  });

  describe('edge cases and validation', () => {
    it('should handle finalOutput with multiple numbers matching same tool result', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'Value 3.2 appears again as 3.2';
      const toolResults = [
        {
          tool: 'FRED',
          result: { value: 3.2 },
        },
      ];

      const mockCitation1 = { id: 'citation-1' } as DataCitation;
      const mockCitation2 = { id: 'citation-2' } as DataCitation;

      mockRepository.create.mockReturnValueOnce(mockCitation1);
      mockRepository.create.mockReturnValueOnce(mockCitation2);
      mockRepository.save.mockResolvedValueOnce(mockCitation1);
      mockRepository.save.mockResolvedValueOnce(mockCitation2);

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should determine source type from tool metadata', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'Price is 150.25';
      const toolResults = [
        {
          tool: 'Polygon',
          result: {
            ticker: 'AAPL',
            close: 150.25,
          },
        },
      ];

      const mockCitation = {
        id: 'citation-1',
        sourceType: CitationSourceType.POLYGON,
        sourceIdentifier: 'AAPL',
      } as DataCitation;

      mockRepository.create.mockReturnValue(mockCitation);
      mockRepository.save.mockResolvedValue(mockCitation);

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].sourceType).toBe(CitationSourceType.POLYGON);
      expect(result[0].sourceIdentifier).toBe('AAPL');
    });

    it('should return partial results if some extractions fail', async () => {
      // Arrange
      const threadId = 'thread-123';
      const userId = 'user-456';
      const finalOutput = 'Value 3.2 and value 5.0';
      const toolResults = [
        { tool: 'FRED', result: { value: 3.2 } },
        { tool: 'FRED', result: { value: 5.0 } },
      ];

      const mockCitation1 = { id: 'citation-1' } as DataCitation;

      mockRepository.create.mockReturnValueOnce(mockCitation1);
      mockRepository.create.mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      mockRepository.save.mockResolvedValueOnce(mockCitation1);

      // Act
      const result = await service.extractCitations(
        threadId,
        userId,
        finalOutput,
        toolResults,
      );

      // Assert - Should return successful citation even though one failed
      expect(result).toHaveLength(1);
    });
  });
});
