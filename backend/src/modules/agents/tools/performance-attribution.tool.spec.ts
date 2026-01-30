import { createPerformanceAttributionTool, PerformanceAttributionSchema } from './performance-attribution.tool';
import { Timeframe } from '../../performance/types/timeframe.types';
import { PerformanceService } from '../../performance/performance.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { SectorAttributionService } from '../../performance/services/sector-attribution.service';
import { MissingDataException } from '../../performance/exceptions/missing-data.exception';

describe('PerformanceAttributionTool', () => {
    let mockPerformanceService: jest.Mocked<PerformanceService>;
    let mockPortfolioService: jest.Mocked<PortfolioService>;
    let mockSectorAttributionService: jest.Mocked<SectorAttributionService>;

    let tool: ReturnType<typeof createPerformanceAttributionTool>;

    beforeEach(() => {
        mockPerformanceService = {
            getBenchmarkComparison: jest.fn(),
        } as any;

        mockPortfolioService = {
            getHoldingsWithSectorData: jest.fn(),
        } as any;

        mockSectorAttributionService = {
            calculateSectorWeights: jest.fn(),
            getTopPerformers: jest.fn(),
        } as any;

        tool = createPerformanceAttributionTool(
            mockPerformanceService,
            mockPortfolioService,
            mockSectorAttributionService,
        );
    });

    it('should be defined', () => {
        expect(tool).toBeDefined();
        expect(tool.name).toBe('performance_attribution');
    });

    it('should have correct schema', () => {
        expect(tool.schema).toEqual(PerformanceAttributionSchema);
    });

    it('should analyze performance and return summary', async () => {
        const input = {
            portfolioId: 'p123',
            timeframe: Timeframe.YEAR_TO_DATE,
            userId: 'u123',
        };

        // Mock service responses
        mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
            portfolioReturn: 0.15,
            benchmarkReturn: 0.10,
            alpha: 0.05,
            benchmarkTicker: 'SPY',
            timeframe: Timeframe.YEAR_TO_DATE,
            portfolioPeriodReturn: 0.15,
            benchmarkPeriodReturn: 0.10,
            periodDays: 90,
        });

        mockPortfolioService.getHoldingsWithSectorData.mockResolvedValue([
            { sector: 'Technology', ticker: 'AAPL', avgCostBasis: 100, currentPrice: 120, weight: 0.5, quantity: 10, marketValue: 1200 },
        ]);

        mockSectorAttributionService.calculateSectorWeights.mockResolvedValue([
            { sector: 'Technology', weight: 0.5, marketValue: 1200 },
        ]);

        mockSectorAttributionService.getTopPerformers.mockResolvedValue([
            { ticker: 'AAPL', currentPrice: 120, avgCostBasis: 100, quantity: 10, marketValue: 1200, sector: 'Technology', weight: 0.5 },
        ]);

        const result = await tool.invoke(input);
        const parsed = JSON.parse(result);

        expect(parsed).toMatchObject({
            portfolioId: 'p123',
            timeframe: Timeframe.YEAR_TO_DATE,
            portfolioReturn: 0.15,
            benchmarkReturn: 0.10,
            alpha: 0.05,
        });

        expect(parsed.summary).toContain('outperforming');
        expect(parsed.summary).toContain('Technology');
        expect(parsed.summary).toContain('AAPL');
    });

    it('should handle underperformance and provide explanation', async () => {
        const input = {
            portfolioId: 'p123',
            timeframe: Timeframe.ONE_YEAR,
            userId: 'u123',
        };

        mockPerformanceService.getBenchmarkComparison.mockResolvedValue({
            portfolioReturn: 0.05,
            benchmarkReturn: 0.10,
            alpha: -0.05,
            benchmarkTicker: 'SPY',
            timeframe: Timeframe.ONE_YEAR,
            portfolioPeriodReturn: 0.05,
            benchmarkPeriodReturn: 0.10,
            periodDays: 365,
        });

        // Simulate empty deep analysis for simplicity or just basic check
        mockPortfolioService.getHoldingsWithSectorData.mockResolvedValue([]);

        const result = await tool.invoke(input);
        const parsed = JSON.parse(result);

        expect(parsed.alpha).toBe(-0.05);
        expect(parsed.summary).toContain('underperforming');
    });

    it('should handle missing data exception', async () => {
        const input = {
            portfolioId: 'p123',
            timeframe: Timeframe.YEAR_TO_DATE,
            userId: 'u123',
        };

        mockPerformanceService.getBenchmarkComparison.mockRejectedValue(
            new MissingDataException('SPY', 'No data found'),
        );

        const result = await tool.invoke(input);

        expect(result).toContain('Error: Issue retrieving market data');
    });
});
