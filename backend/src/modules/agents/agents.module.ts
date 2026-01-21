import { Module, forwardRef, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AgentsController } from './agents.controller';
import { TokenUsage } from './entities/token-usage.entity';
import { ReasoningTrace } from './entities/reasoning-trace.entity';
import { GeminiLlmService } from './services/gemini-llm.service';
import { TokenUsageService } from './services/token-usage.service';
import { TracingService } from './services/tracing.service';
import { StateService } from './services/state.service';
import { ToolRegistryService } from './services/tool-registry.service';
import { OrchestratorService } from './services/orchestrator.service';
import { GraphExecutorService } from './services/graph-executor.service';
import { InterruptHandlerService } from './services/interrupt-handler.service';
import { getCurrentTimeTool } from './tools/time.tool';
import { createTechnicalAnalystTool } from './tools/technical-analyst.tool';
import { createRiskManagerTool } from './tools/risk-manager.tool';
import { createMacroAnalystTool } from './tools/macro-analyst.tool';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { AssetsModule } from '../assets/assets.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { PerformanceModule } from '../performance/performance.module';
import { CitationsModule } from '../citations/citations.module';
import { PolygonApiService } from '../assets/services/polygon-api.service';
import { FredService } from '../assets/services/fred.service';
import { NewsService } from '../assets/services/news.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
    JwtAuthGuard, // Provide JwtAuthGuard locally
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
  }
}
