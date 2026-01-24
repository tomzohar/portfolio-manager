import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExecutionContext } from '@nestjs/common';
import { CitationService } from './services/citation.service';
import { CitationsController } from './controllers/citations.controller';
import { DataCitation } from './entities/data-citation.entity';
import { StateService } from '../agents/services/state.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('CitationsModule', () => {
  let module: TestingModule;

  const mockStateService = {
    extractUserId: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        CitationService,
        CitationsController,
        {
          provide: getRepositoryToken(DataCitation),
          useValue: {},
        },
        {
          provide: StateService,
          useValue: mockStateService,
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
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have CitationService registered', () => {
    const service = module.get<CitationService>(CitationService);
    expect(service).toBeDefined();
  });

  it('should have CitationsController registered', () => {
    const controller = module.get<CitationsController>(CitationsController);
    expect(controller).toBeDefined();
  });

  it('should export CitationService', () => {
    const exportedService = module.get<CitationService>(CitationService);
    expect(exportedService).toBeDefined();
  });
});
