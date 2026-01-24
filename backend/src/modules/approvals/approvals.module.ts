import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { HITLApproval } from './entities/hitl-approval.entity';
import { ApprovalService } from './services/approval.service';
import { CostEstimationService } from './services/cost-estimation.service';
import { ApprovalsController } from './controllers/approvals.controller';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

/**
 * Approvals Module
 *
 * Manages Human-in-the-Loop (HITL) approval gates for the agent system.
 * Enables cost threshold approvals and user consent before executing
 * expensive analysis operations.
 *
 * Features:
 * - Create approval requests when cost thresholds are exceeded
 * - Track approval status (pending, approved, rejected, expired)
 * - Cost estimation for analysis plans
 * - Approval expiration via cron jobs
 * - Resume graph execution on approval
 *
 * This module supports US-003: HITL Approval System
 * from the Digital CIO Chat Interface feature.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([HITLApproval]),
    JwtModule, // For JwtAuthGuard (JwtService)
    ScheduleModule.forRoot(), // For cron jobs
    forwardRef(() => AuthModule), // For JwtAuthGuard
    forwardRef(() => UsersModule), // For UsersService (needed by JwtAuthGuard)
    forwardRef(() => AgentsModule), // For OrchestratorService, StateService
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalService, CostEstimationService],
  exports: [ApprovalService, CostEstimationService],
})
export class ApprovalsModule {}
