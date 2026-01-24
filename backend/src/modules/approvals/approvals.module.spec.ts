import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExecutionContext } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApprovalService } from './services/approval.service';
import { CostEstimationService } from './services/cost-estimation.service';
import { ApprovalsController } from './controllers/approvals.controller';
import { HITLApproval } from './entities/hitl-approval.entity';
import { StateService } from '../agents/services/state.service';
import { OrchestratorService } from '../agents/services/orchestrator.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('ApprovalsModule', () => {
  let module: TestingModule;

  const mockStateService = {
    extractUserId: jest.fn(),
  };

  const mockOrchestratorService = {
    resumeGraph: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        ApprovalService,
        CostEstimationService,
        ApprovalsController,
        {
          provide: getRepositoryToken(HITLApproval),
          useValue: {},
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: StateService,
          useValue: mockStateService,
        },
        {
          provide: OrchestratorService,
          useValue: mockOrchestratorService,
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

  it('should have ApprovalService registered', () => {
    const service = module.get<ApprovalService>(ApprovalService);
    expect(service).toBeDefined();
  });

  it('should have CostEstimationService registered', () => {
    const service = module.get<CostEstimationService>(CostEstimationService);
    expect(service).toBeDefined();
  });

  it('should have ApprovalsController registered', () => {
    const controller = module.get<ApprovalsController>(ApprovalsController);
    expect(controller).toBeDefined();
  });

  it('should export ApprovalService', () => {
    const exportedService = module.get<ApprovalService>(ApprovalService);
    expect(exportedService).toBeDefined();
  });

  it('should export CostEstimationService', () => {
    const exportedService = module.get<CostEstimationService>(
      CostEstimationService,
    );
    expect(exportedService).toBeDefined();
  });
});
