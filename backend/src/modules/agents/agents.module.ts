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
import { TransactionsService } from '../portfolio/transactions.service';
import { UsersModule } from '../users/users.module';
import { FinnhubApiService } from '../assets/services/finnhub-api.service';
import { FmpApiService } from '../assets/services/fmp-api.service';
import { TechnicalIndicatorsService } from '../assets/services/technical-indicators.service';
import { AgentsController } from './agents.controller';
import { createStockScreenerTool } from './tools/stock-screener.tool';
import { ReasoningTrace } from './entities/reasoning-trace.entity';
import { TokenUsage } from './entities/token-usage.entity';
import { UISurface } from './entities/ui-surface.entity';
import { GeminiLlmService } from './services/gemini-llm.service';
import { GrokLlmService } from './services/grok-llm.service';
import { GraphExecutorService } from './services/graph-executor.service';
import { InterruptHandlerService } from './services/interrupt-handler.service';
import { OrchestratorService } from './services/orchestrator.service';
import { StateService } from './services/state.service';
import { TokenUsageService } from './services/token-usage.service';
import { ToolRegistryService } from './services/tool-registry.service';
import { TracingService } from './services/tracing.service';
import { A2UICatalogService } from './services/a2ui-catalog.service';
import { UISurfaceService } from './services/ui-surface.service';
import { DataNormalizationService } from './services/data-normalization.service';
import { createMacroAnalystTool } from './tools/macro-analyst.tool';
import { createRiskManagerTool } from './tools/risk-manager.tool';
import { createSearchHistoryTool } from './tools/search-history.tool';
import { createSearchPortfoliosTool } from './tools/search-portfolios.tool';
import { createTechnicalAnalystTool } from './tools/technical-analyst.tool';
import { createFundamentalAnalystTool } from './tools/fundamental-analyst.tool';
import { createEarningsCalendarTool } from './tools/earnings-calendar.tool';
import { getCurrentTimeTool } from './tools/time.tool';
import { createNewsSentimentTool } from './tools/news-sentiment.tool';
import { createPerformanceAttributionTool } from './tools/performance-attribution.tool';
import { createChartBuilderTool } from './tools/chart-builder.tool';
import { PerformanceService } from '../performance/performance.service';
import { SectorAttributionService } from '../performance/services/sector-attribution.service';
import { ManageUISurfaceTool } from './tools/manage-ui-surface.tool';

@Module({
  imports: [
    TypeOrmModule.forFeature([TokenUsage, ReasoningTrace, UISurface]),
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
    GrokLlmService,
    TokenUsageService,
    TracingService,
    StateService,
    ToolRegistryService,
    GraphExecutorService,
    InterruptHandlerService,
    OrchestratorService,
    JwtAuthGuard,
    A2UICatalogService,
    UISurfaceService,
    DataNormalizationService,
    ManageUISurfaceTool, // Added ManageUISurfaceTool
  ],
  exports: [
    OrchestratorService,
    GeminiLlmService,
    GrokLlmService,
    TokenUsageService,
    TracingService,
    StateService,
    UISurfaceService,
    DataNormalizationService,
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
    private readonly finnhubService: FinnhubApiService,
    private readonly fmpService: FmpApiService,
    private readonly indicatorService: TechnicalIndicatorsService,
    private readonly geminiService: GeminiLlmService,
    private readonly portfolioService: PortfolioService,
    private readonly performanceService: PerformanceService, // Injected PerformanceService
    private readonly sectorAttributionService: SectorAttributionService, // Injected SectorAttributionService
    private readonly transactionsService: TransactionsService,
    private readonly conversationService: ConversationService,
    private readonly grokService: GrokLlmService,
    private readonly manageUISurfaceTool: ManageUISurfaceTool, // Injected ManageUISurfaceTool
    private readonly uiSurfaceService: UISurfaceService,
    private readonly catalogService: A2UICatalogService,
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
    this.toolRegistry.registerTool(this.manageUISurfaceTool); // Registered ManageUISurfaceTool
    this.logger.log('Registered manage_ui_surface tool'); // Added log for ManageUISurfaceTool
  }

  private registerDefaultTools() {
    this.toolRegistry.registerTool(getCurrentTimeTool);
    this.toolRegistry.registerTool(
      createTechnicalAnalystTool(this.polygonService, this.indicatorService),
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
    this.toolRegistry.registerTool(
      createSearchPortfoliosTool(
        this.portfolioService,
        this.transactionsService,
      ),
    );
    this.logger.log('Registered search_portfolios tool');
    this.toolRegistry.registerTool(
      createFundamentalAnalystTool(this.polygonService),
    );
    this.logger.log('Registered fundamental_analyst tool');
    this.toolRegistry.registerTool(
      createEarningsCalendarTool(this.finnhubService),
    );
    this.logger.log('Registered earnings_calendar tool');
    this.toolRegistry.registerTool(
      createNewsSentimentTool(this.polygonService, this.grokService),
    );
    this.logger.log('Registered news_sentiment_scanner tool');
    this.toolRegistry.registerTool(
      createStockScreenerTool(
        this.fmpService,
        this.polygonService,
        this.indicatorService,
      ),
    );
    this.logger.log('Registered stock_screener tool');
    this.toolRegistry.registerTool(
      createPerformanceAttributionTool(
        this.performanceService,
        this.portfolioService,
        this.sectorAttributionService,
      ),
    );
    this.logger.log('Registered performance_attribution tool');
    this.toolRegistry.registerTool(
      createChartBuilderTool(
        this.polygonService,
        this.indicatorService,
        this.uiSurfaceService,
        this.catalogService,
      ),
    );
    this.logger.log('Registered chart_builder tool');
  }
}
