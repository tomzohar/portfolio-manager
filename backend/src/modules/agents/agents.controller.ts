import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { OrchestratorService } from './services/orchestrator.service';
import { RunGraphDto } from './dto/run-graph.dto';
import { GraphResponseDto } from './dto/graph-response.dto';

@ApiTags('agents')
@Controller('agents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentsController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Post('run')
  @ApiOperation({
    summary: 'Run CIO graph analysis',
    description:
      'Execute the CIO graph for portfolio analysis and recommendations',
  })
  @ApiResponse({
    status: 200,
    description: 'Graph executed successfully',
    type: GraphResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  async runGraph(
    @CurrentUser() user: User,
    @Body() dto: RunGraphDto,
  ): Promise<GraphResponseDto> {
    return this.orchestratorService.runGraph(
      user.id,
      {
        message: dto.message,
        portfolio: dto.portfolio,
      },
      dto.threadId,
    ) as Promise<GraphResponseDto>;
  }
}
