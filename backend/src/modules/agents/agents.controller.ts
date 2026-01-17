import {
  Controller,
  Post,
  Body,
  UseGuards,
  Sse,
  Param,
  MessageEvent,
  Get,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { OrchestratorService } from './services/orchestrator.service';
import { RunGraphDto } from './dto/run-graph.dto';
import { GraphResponseDto } from './dto/graph-response.dto';
import { TracesResponseDto } from './dto/traces-response.dto';
import { TracingService } from './services/tracing.service';
import { StateService } from './services/state.service';
import { ResumeGraphDto } from './dto/resume-graph.dto';

@ApiTags('agents')
@Controller('agents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentsController {
  constructor(
    private readonly orchestratorService: OrchestratorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly tracingService: TracingService,
    private readonly stateService: StateService,
  ) {}

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

  @Post('resume')
  @ApiOperation({
    summary: 'Resume suspended graph execution',
    description:
      'Continue graph execution after Human-in-the-Loop (HITL) interrupt. ' +
      'When a graph is interrupted (status: SUSPENDED), this endpoint allows resuming ' +
      'execution with user-provided input. The user input is made available to the ' +
      'resumed node and appended to the conversation history.',
  })
  @ApiResponse({
    status: 200,
    description: 'Graph resumed and completed successfully',
    type: GraphResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input or thread not suspended',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot access other users threads',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Thread does not exist',
  })
  @HttpCode(200) // Explicitly set 200 for POST resume
  async resumeGraph(
    @CurrentUser() user: User,
    @Body() dto: ResumeGraphDto,
  ): Promise<GraphResponseDto> {
    return this.orchestratorService.resumeGraph(
      user.id,
      dto.threadId,
      dto.userInput,
    ) as Promise<GraphResponseDto>;
  }

  @Get('traces/:threadId')
  @ApiOperation({
    summary: 'Get historical reasoning traces for a thread',
    description:
      'Retrieves all reasoning traces for a specific graph execution thread in chronological order. ' +
      'Traces provide transparency into the agent decision-making process. ' +
      'Users can only access their own traces (filtered by userId).',
  })
  @ApiParam({
    name: 'threadId',
    description: 'Thread identifier to retrieve traces for',
    type: 'string',
    example: '123e4567-e89b-12d3-a456-426614174000:abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Traces retrieved successfully',
    type: TracesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot access threads belonging to other users',
  })
  async getTraces(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
  ): Promise<TracesResponseDto> {
    // Security: Validate thread ownership before querying database
    // This prevents thread ID enumeration attacks
    const userId = this.stateService.extractUserId(threadId);
    if (!userId || userId !== user.id) {
      throw new ForbiddenException(
        'Cannot access threads belonging to other users',
      );
    }

    const traces = await this.tracingService.getTracesByThread(
      threadId,
      user.id,
    );

    return {
      threadId,
      traces,
    };
  }

  @Sse('traces/stream/:threadId')
  @ApiOperation({
    summary: 'Stream reasoning traces in real-time via SSE',
    description:
      'Server-Sent Events endpoint that streams LLM tokens and node events as the graph executes. ' +
      'Supports ChatGPT-style token-by-token streaming for real-time UX. ' +
      'Events are filtered by threadId and userId for security.',
  })
  @ApiParam({
    name: 'threadId',
    description: 'The thread ID to stream events for',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream established successfully',
    content: {
      'text/event-stream': {
        schema: {
          type: 'object',
          properties: {
            event: {
              type: 'string',
              enum: [
                'llm.start',
                'llm.token',
                'llm.complete',
                'node.complete',
                'graph.complete',
              ],
              description: 'The type of event being streamed',
            },
            data: {
              type: 'object',
              description: 'Event payload (varies by event type)',
            },
          },
        },
        examples: {
          'llm.start': {
            value: {
              event: 'llm.start',
              data: {
                threadId: 'thread-123',
                userId: 'user-456',
                timestamp: '2024-01-15T12:00:00Z',
              },
            },
          },
          'llm.token': {
            value: {
              event: 'llm.token',
              data: {
                threadId: 'thread-123',
                userId: 'user-456',
                token: 'The',
                timestamp: '2024-01-15T12:00:01Z',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  streamTraces(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
  ): Observable<MessageEvent> {
    return new Observable((observer) => {
      // Event types to listen for
      const eventTypes = [
        'llm.start',
        'llm.token',
        'llm.complete',
        'node.complete',
        'graph.complete',
      ];

      // Create listeners for each event type
      const listeners = eventTypes.map((eventType) => {
        const listener = (payload: {
          threadId: string;
          userId: string;
          timestamp: string;
        }) => {
          // Security: Filter events by threadId and userId
          if (payload.threadId === threadId && payload.userId === user.id) {
            // Handle graph completion - close the stream
            if (eventType === 'graph.complete') {
              observer.next({
                type: eventType,
                data: payload,
              } as MessageEvent);
              observer.complete(); // Close the SSE stream
              return;
            }

            // Emit SSE message
            observer.next({
              type: eventType,
              data: payload,
            } as MessageEvent);
          }
        };

        // Register the listener
        this.eventEmitter.on(eventType, listener);

        // Return cleanup function
        return () => {
          this.eventEmitter.off(eventType, listener);
        };
      });

      // Cleanup function when client disconnects
      return () => {
        listeners.forEach((cleanup) => cleanup());
      };
    });
  }
}
