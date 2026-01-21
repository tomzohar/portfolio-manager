import { Controller, Logger } from '@nestjs/common';
import { ApprovalService } from '../services/approval.service';

/**
 * ApprovalsController
 *
 * REST endpoints for approval management.
 * Will be implemented in US-003-BE-T6.
 */
@Controller('approvals')
export class ApprovalsController {
  private readonly logger = new Logger(ApprovalsController.name);

  constructor(private readonly approvalService: ApprovalService) {}

  // Endpoints will be implemented in US-003-BE-T6
}
