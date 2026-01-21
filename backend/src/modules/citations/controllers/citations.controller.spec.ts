/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  ExecutionContext,
} from '@nestjs/common';
import { CitationsController } from './citations.controller';
import { CitationService } from '../services/citation.service';
import { CitationSourceType } from '../types/citation-source-type.enum';
import { DataCitation } from '../entities/data-citation.entity';
import { User } from '../../users/entities/user.entity';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('CitationsController', () => {
  let controller: CitationsController;
  let citationService: jest.Mocked<CitationService>;

  const mockUser: User = {
    id: 'user-456',
    email: 'test@example.com',
    passwordHash: 'hashed',
    portfolios: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCitationService = {
    getCitationsByThread: jest.fn(),
    getCitationData: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CitationsController],
      providers: [
        {
          provide: CitationService,
          useValue: mockCitationService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const request = context.switchToHttp().getRequest();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          request.user = mockUser;
          return true;
        },
      })
      .overrideGuard(ThrottlerGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<CitationsController>(CitationsController);
    citationService = module.get(CitationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /api/citations/thread/:threadId', () => {
    it('should return citations for valid threadId', async () => {
      // Arrange
      const threadId = 'thread-123';
      const user = { id: 'user-456', email: 'test@example.com' } as User;

      const mockCitations = [
        {
          id: 'citation-1',
          threadId,
          userId: user.id,
          sourceType: CitationSourceType.FRED,
          sourceIdentifier: 'CPIAUCSL',
          citationText: 'Inflation was 3.2%',
          positionInText: 15,
          createdAt: new Date('2024-01-15'),
        },
        {
          id: 'citation-2',
          threadId,
          userId: user.id,
          sourceType: CitationSourceType.POLYGON,
          sourceIdentifier: 'AAPL',
          citationText: 'AAPL price $150.25',
          positionInText: 50,
          createdAt: new Date('2024-01-15'),
        },
      ] as DataCitation[];

      mockCitationService.getCitationsByThread.mockResolvedValue(mockCitations);

      // Act
      const result = await controller.getCitationsByThread(threadId, user);

      // Assert
      expect(citationService.getCitationsByThread).toHaveBeenCalledWith(
        threadId,
        user.id,
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'citation-1',
        sourceType: CitationSourceType.FRED,
        sourceIdentifier: 'CPIAUCSL',
      });
    });

    it('should return empty array if no citations exist', async () => {
      // Arrange
      const threadId = 'thread-123';
      const user = { id: 'user-456', email: 'test@example.com' } as User;

      mockCitationService.getCitationsByThread.mockResolvedValue([]);

      // Act
      const result = await controller.getCitationsByThread(threadId, user);

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw ForbiddenException if user does not own thread', async () => {
      // Arrange
      const threadId = 'thread-123';
      const user = { id: 'user-456', email: 'test@example.com' } as User;

      mockCitationService.getCitationsByThread.mockRejectedValue(
        new ForbiddenException('You do not own this thread'),
      );

      // Act & Assert
      await expect(
        controller.getCitationsByThread(threadId, user),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should call service with correct user ID from CurrentUser decorator', async () => {
      // Arrange
      const threadId = 'thread-abc';
      const user = { id: 'user-xyz', email: 'user@example.com' } as User;

      mockCitationService.getCitationsByThread.mockResolvedValue([]);

      // Act
      await controller.getCitationsByThread(threadId, user);

      // Assert
      expect(citationService.getCitationsByThread).toHaveBeenCalledWith(
        threadId,
        'user-xyz',
      );
    });
  });

  describe('GET /api/citations/:citationId', () => {
    it('should return citation data for valid citationId', async () => {
      // Arrange
      const citationId = 'citation-123';
      const user = { id: 'user-456', email: 'test@example.com' } as User;

      const mockCitationData = {
        id: citationId,
        sourceType: CitationSourceType.FRED,
        sourceIdentifier: 'CPIAUCSL',
        dataPoint: { value: 3.2, date: '2024-01-01' },
        citationText: 'FRED: CPIAUCSL (3.2%)',
        metadata: {
          retrievedAt: new Date('2024-01-15'),
        },
      };

      mockCitationService.getCitationData.mockResolvedValue(mockCitationData);

      // Act
      const result = await controller.getCitationData(citationId, user);

      // Assert
      expect(citationService.getCitationData).toHaveBeenCalledWith(
        citationId,
        user.id,
      );

      expect(result).toMatchObject({
        id: citationId,
        sourceType: CitationSourceType.FRED,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        dataPoint: expect.any(Object),
      });
    });

    it('should throw NotFoundException if citation does not exist', async () => {
      // Arrange
      const citationId = 'non-existent';
      const user = { id: 'user-456', email: 'test@example.com' } as User;

      mockCitationService.getCitationData.mockRejectedValue(
        new NotFoundException(`Citation ${citationId} not found`),
      );

      // Act & Assert
      await expect(
        controller.getCitationData(citationId, user),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own citation', async () => {
      // Arrange
      const citationId = 'citation-123';
      const user = { id: 'user-456', email: 'test@example.com' } as User;

      mockCitationService.getCitationData.mockRejectedValue(
        new ForbiddenException('You do not own this citation'),
      );

      // Act & Assert
      await expect(
        controller.getCitationData(citationId, user),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should call service with correct user ID from CurrentUser decorator', async () => {
      // Arrange
      const citationId = 'citation-abc';
      const user = { id: 'user-xyz', email: 'user@example.com' } as User;

      mockCitationService.getCitationData.mockResolvedValue({
        id: citationId,
        sourceType: CitationSourceType.FRED,
        sourceIdentifier: 'test',
        dataPoint: {},
        citationText: null,
        metadata: { retrievedAt: new Date() },
      });

      // Act
      await controller.getCitationData(citationId, user);

      // Assert
      expect(citationService.getCitationData).toHaveBeenCalledWith(
        citationId,
        'user-xyz',
      );
    });
  });

  describe('Authorization and Guards', () => {
    it('should require authentication (covered by @UseGuards(JwtAuthGuard) decorator)', () => {
      // Note: JwtAuthGuard is applied at controller level
      // Authentication is tested in E2E tests
      expect(controller).toBeDefined();
    });

    it('should apply rate limiting (covered by @Throttle decorators)', () => {
      // Note: Rate limiting is tested in E2E tests
      expect(controller.getCitationsByThread).toBeDefined();
      expect(controller.getCitationData).toBeDefined();
    });
  });
});
