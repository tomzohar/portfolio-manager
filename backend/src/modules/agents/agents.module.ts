import { forwardRef, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsModule } from '../assets';
import { FredService } from '../assets/services/fred.service';
import { NewsService } from '../assets/services/news.service';
import { PolygonApiService } from '../assets/services/polygon-api.service';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CitationsModule } from '../citations/citations.module';
import { ConversationsModule } from '../conversations';
import { ConversationService } from '../conversations/services/conversation.service';
import { PerformanceModule } from '../performance';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { PortfolioService } from '../portfolio/portfolio.service';
import { UsersModule } from '../users/users.module';
import { AgentsController } from './agents.controller';
import { ReasoningTrace } from './entities/reasoning-trace.entity';
import { TokenUsage } from './entities/token-usage.entity';
import { GeminiLlmService } from './services/gemini-llm.service';
import { GraphExecutorService } from './services/graph-executor.service';
import { InterruptHandlerService } from './services/interrupt-handler.service';
import { OrchestratorService } from './services/orchestrator.service';
import { StateService } from './services/state.service';
import { TokenUsageService } from './services/token-usage.service';
import { ToolRegistryService } from './services/tool-registry.service';
import { TracingService } from './services/tracing.service';
import { createMacroAnalystTool } from './tools/macro-analyst.tool';
import { createRiskManagerTool } from './tools/risk-manager.tool';
import { createSearchHistoryTool } from './tools/search-history.tool';
import { createTechnicalAnalystTool } from './tools/technical-analyst.tool';
import { getCurrentTimeTool } from './tools/time.tool';

@Module({
  imports: [
    TypeOrmModule.forFeature([TokenUsage, ReasoningTrace]),
    ConfigModule,
    JwtModule, // Import JwtModule for JwtService (set to global in AuthModule)
    forwardRef(() => AuthModule), // Import AuthModule for JwtAuthGuard
    forwardRef(() => UsersModule), // Import UsersModule for UsersService (needed by JwtAuthGuard)
    forwardRef(() => AssetsModule), // Import AssetsModule for PolygonApiService
    forwardRef(() => PortfolioModule), // Import PortfolioModule for PortfolioService
    forwardRef(() => PerformanceModule), // Import PerformanceModule for PerformanceService
    forwardRef(() => CitationsModule), // Import CitationsModule for CitationService
    forwardRef(() => ConversationsModule), // Import ConversationsModule for ConversationService
  ],
  controllers: [AgentsController],
  providers: [
    GeminiLlmService,
    TokenUsageService,
    TracingService,
    StateService,
    ToolRegistryService,
    GraphExecutorService,
    InterruptHandlerService,
    OrchestratorService,
    JwtAuthGuard,
  ],
  exports: [
    OrchestratorService,
    GeminiLlmService,
    TokenUsageService,
    TracingService,
    StateService,
  ],
})
export class AgentsModule {
  private readonly logger = new Logger(AgentsModule.name);

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly stateService: StateService,
    private readonly polygonService: PolygonApiService,
    private readonly fredService: FredService,
    private readonly newsService: NewsService,
    private readonly geminiService: GeminiLlmService,
    private readonly portfolioService: PortfolioService,
    private readonly conversationService: ConversationService, // Injected
  ) {
    this.registerDefaultTools();
  }

  async onModuleInit() {
    // Setup PostgresSaver tables (checkpoints, checkpoint_writes)
    try {
      await this.stateService.setupTables();
      this.logger.log('Checkpoint tables initialized');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('already exists')) {
        this.logger.warn(`Failed to setup checkpoint tables: ${errorMessage}`);
      }
    }
  }

  private registerDefaultTools() {
    this.toolRegistry.registerTool(getCurrentTimeTool);
    this.toolRegistry.registerTool(
      createTechnicalAnalystTool(this.polygonService),
    );
    this.logger.log('Registered technical_analyst tool');
    this.toolRegistry.registerTool(
      createMacroAnalystTool(
        this.fredService,
        this.newsService,
        this.geminiService,
      ),
    );
    this.logger.log('Registered macro_analyst tool');
    this.toolRegistry.registerTool(
      createRiskManagerTool(this.portfolioService, this.polygonService),
    );
    this.logger.log('Registered risk_manager tool');
    this.toolRegistry.registerTool(
      createSearchHistoryTool(this.conversationService),
    );
    this.logger.log('Registered search_history tool');
  }
}
