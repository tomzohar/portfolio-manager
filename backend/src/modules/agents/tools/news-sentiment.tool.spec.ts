import { of, throwError } from 'rxjs';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { GrokLlmService } from '../services/grok-llm.service';
import { PolygonNewsArticle } from '../../assets/types/polygon-news.types';
import { TickerDetails } from '../../assets/types/polygon-api.types';
import {
    createNewsSentimentTool,
    calculateDateRange,
} from './news-sentiment.tool';

describe('NewsSentimentTool', () => {
    let mockPolygonService: jest.Mocked<PolygonApiService>;
    let mockGrokService: jest.Mocked<GrokLlmService>;

    const mockArticles: PolygonNewsArticle[] = [
        {
            id: '1',
            publisher: { name: 'Test Publisher', homepage_url: 'https://test.com' },
            title: 'NVDA Reports Record Earnings',
            author: 'John Doe',
            published_utc: '2026-01-28T10:00:00Z',
            article_url: 'https://test.com/article1',
            tickers: ['NVDA'],
            description: 'NVIDIA announced record quarterly revenue',
            keywords: ['earnings', 'AI'],
        },
        {
            id: '2',
            publisher: { name: 'Finance News', homepage_url: 'https://fn.com' },
            title: 'Analysts Upgrade NVDA',
            author: 'Jane Smith',
            published_utc: '2026-01-27T14:00:00Z',
            article_url: 'https://fn.com/article2',
            tickers: ['NVDA'],
            description: 'Multiple analysts raised price targets',
            keywords: ['analyst', 'upgrade'],
        },
    ];

    const mockTickerDetails: TickerDetails = {
        ticker: 'NVDA',
        name: 'NVIDIA Corporation',
        market: 'stocks',
        locale: 'us',
        type: 'CS',
        active: true,
        currency_name: 'usd',
    };

    const mockGrokResponse = {
        text: JSON.stringify({
            article_sentiments: [
                { title: 'NVDA Reports Record Earnings', sentiment: 'bullish', score: 0.9 },
                { title: 'Analysts Upgrade NVDA', sentiment: 'bullish', score: 0.85 },
            ],
            overall_sentiment: 'bullish',
            confidence: 0.87,
            recommendation: 'Strong buy on AI momentum',
            key_narratives: ['AI growth', 'Record earnings'],
            risk_factors: ['Valuation concerns'],
        }),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    };

    beforeEach(() => {
        mockPolygonService = {
            getTickerNews: jest.fn(),
            getTickerDetails: jest.fn(),
        } as unknown as jest.Mocked<PolygonApiService>;

        mockGrokService = {
            generateContent: jest.fn(),
        } as unknown as jest.Mocked<GrokLlmService>;
    });

    describe('calculateDateRange', () => {
        it('should calculate correct date range for 7 days', () => {
            const result = calculateDateRange(7);

            expect(result.from).toBeDefined();
            expect(result.to).toBeDefined();

            const fromDate = new Date(result.from);
            const toDate = new Date(result.to);
            const diffDays = Math.round(
                (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
            );

            expect(diffDays).toBe(7);
        });

        it('should handle 30 days lookback', () => {
            const result = calculateDateRange(30);

            const fromDate = new Date(result.from);
            const toDate = new Date(result.to);
            const diffDays = Math.round(
                (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
            );

            expect(diffDays).toBe(30);
        });
    });

    describe('createNewsSentimentTool', () => {
        it('should create a tool with correct name and schema', () => {
            const tool = createNewsSentimentTool(mockPolygonService, mockGrokService);

            expect(tool.name).toBe('news_sentiment_scanner');
            expect(tool.description).toContain('news');
            expect(tool.description).toContain('sentiment');
        });

        it('should return news with sentiment analysis for valid ticker', async () => {
            mockPolygonService.getTickerDetails.mockReturnValue(of(mockTickerDetails));
            mockPolygonService.getTickerNews.mockReturnValue(of(mockArticles));
            mockGrokService.generateContent.mockResolvedValue(mockGrokResponse);

            const tool = createNewsSentimentTool(mockPolygonService, mockGrokService);
            const result = await tool.invoke({ ticker: 'NVDA', days: 7, limit: 10 });
            const parsed = JSON.parse(result);

            expect(parsed.ticker).toBe('NVDA');
            expect(parsed.company_name).toBe('NVIDIA Corporation');
            expect(parsed.news_count).toBe(2);
            expect(parsed.sentiment_summary.overall).toBe('bullish');
            expect(parsed.sentiment_summary.confidence).toBe(0.87);
            expect(parsed.articles).toHaveLength(2);
            expect(parsed.combined_analysis.recommendation).toBe('Strong buy on AI momentum');
        });

        it('should handle ticker with no news gracefully', async () => {
            mockPolygonService.getTickerDetails.mockReturnValue(of(mockTickerDetails));
            mockPolygonService.getTickerNews.mockReturnValue(of([]));

            const tool = createNewsSentimentTool(mockPolygonService, mockGrokService);
            const result = await tool.invoke({ ticker: 'UNKN', days: 7, limit: 10 });
            const parsed = JSON.parse(result);

            expect(parsed.ticker).toBe('UNKN');
            expect(parsed.news_count).toBe(0);
            expect(parsed.sentiment_summary.overall).toBe('neutral');
            expect(parsed.sentiment_summary.confidence).toBe(0);
            expect(parsed.combined_analysis.recommendation).toContain('No recent news');
        });

        it('should handle Polygon API errors gracefully', async () => {
            mockPolygonService.getTickerDetails.mockReturnValue(of(null));
            mockPolygonService.getTickerNews.mockReturnValue(of(null));

            const tool = createNewsSentimentTool(mockPolygonService, mockGrokService);
            const result = await tool.invoke({ ticker: 'FAIL', days: 7, limit: 10 });
            const parsed = JSON.parse(result);

            expect(parsed.ticker).toBe('FAIL');
            expect(parsed.news_count).toBe(0);
        });

        it('should continue with basic analysis if Grok fails', async () => {
            mockPolygonService.getTickerDetails.mockReturnValue(of(mockTickerDetails));
            mockPolygonService.getTickerNews.mockReturnValue(of(mockArticles));
            mockGrokService.generateContent.mockRejectedValue(new Error('Grok API error'));

            const tool = createNewsSentimentTool(mockPolygonService, mockGrokService);
            const result = await tool.invoke({ ticker: 'NVDA', days: 7, limit: 10 });
            const parsed = JSON.parse(result);

            expect(parsed.ticker).toBe('NVDA');
            expect(parsed.news_count).toBe(2);
            expect(parsed.articles).toHaveLength(2);
            // Should still work with neutral defaults
            expect(parsed.sentiment_summary).toBeDefined();
        });

        it('should handle Grok returning invalid JSON', async () => {
            mockPolygonService.getTickerDetails.mockReturnValue(of(mockTickerDetails));
            mockPolygonService.getTickerNews.mockReturnValue(of(mockArticles));
            mockGrokService.generateContent.mockResolvedValue({
                text: 'Not valid JSON at all',
                usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
            });

            const tool = createNewsSentimentTool(mockPolygonService, mockGrokService);
            const result = await tool.invoke({ ticker: 'NVDA', days: 7, limit: 10 });
            const parsed = JSON.parse(result);

            expect(parsed.ticker).toBe('NVDA');
            expect(parsed.news_count).toBe(2);
            // Should fallback to neutral
            expect(parsed.sentiment_summary.overall).toBe('neutral');
        });

        it('should use defaults for optional parameters', async () => {
            mockPolygonService.getTickerDetails.mockReturnValue(of(mockTickerDetails));
            mockPolygonService.getTickerNews.mockReturnValue(of(mockArticles));
            mockGrokService.generateContent.mockResolvedValue(mockGrokResponse);

            const tool = createNewsSentimentTool(mockPolygonService, mockGrokService);
            // Only pass ticker, days and limit should default
            const result = await tool.invoke({ ticker: 'NVDA' });
            const parsed = JSON.parse(result);

            expect(parsed.ticker).toBe('NVDA');
            expect(parsed.date_range).toBeDefined();
        });

        it('should uppercase ticker input', async () => {
            mockPolygonService.getTickerDetails.mockReturnValue(of(mockTickerDetails));
            mockPolygonService.getTickerNews.mockReturnValue(of(mockArticles));
            mockGrokService.generateContent.mockResolvedValue(mockGrokResponse);

            const tool = createNewsSentimentTool(mockPolygonService, mockGrokService);
            const result = await tool.invoke({ ticker: 'nvda' });
            const parsed = JSON.parse(result);

            expect(parsed.ticker).toBe('NVDA');
        });
    });
});
