import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CitationService } from './services/citation.service';
import { CitationsController } from './controllers/citations.controller';
import { DataCitation } from './entities/data-citation.entity';
import { StateService } from '../agents/services/state.service';

describe('CitationsModule', () => {
  let module: TestingModule;

  const mockStateService = {
    extractUserId: jest.fn(),
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
    }).compile();
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
