import { of } from 'rxjs';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { GrokLlmService } from '../services/grok-llm.service';
import { PolygonNewsArticle } from '../../assets/types/polygon-news.types';
import { TickerDetails } from '../../assets/types/polygon-api.types';
import { createNewsSentimentTool } from './news-sentiment.tool';
import { NewsSentimentOutput } from '../types/news-sentiment.types';

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
                {
                    title: 'NVDA Reports Record Earnings',
                    sentiment: 'bullish',
                    score: 0.9,
                },
            ],
            overall_sentiment: 'bullish',
            confidence: 0.87,
            recommendation: 'Strong buy on AI momentum',
            key_narratives: ['AI growth'],
            risk_factors: ['Valuation'],
        }),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    };

    const mockXData = {
        text: 'People on X are very bullish about NVDA. New AI chips are a hit.',
        sources: ['https://x.com/user/status/1'],
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
    };

    beforeEach(() => {
        mockPolygonService = {
            getTickerNews: jest.fn(),
            getTickerDetails: jest.fn(),
        } as unknown as jest.Mocked<PolygonApiService>;

        mockGrokService = {
            generateContent: jest.fn(),
            generateWithXSearch: jest.fn(),
        } as unknown as jest.Mocked<GrokLlmService>;
    });

    describe('createNewsSentimentTool', () => {
        it('should return news with sentiment analysis and X sentiment', async () => {
            mockPolygonService.getTickerDetails.mockReturnValue(
                of(mockTickerDetails),
            );
            mockPolygonService.getTickerNews.mockReturnValue(of(mockArticles));
            mockGrokService.generateContent.mockResolvedValue(mockGrokResponse);
            mockGrokService.generateWithXSearch.mockResolvedValue(mockXData);

            const tool = createNewsSentimentTool(mockPolygonService, mockGrokService);
            const result = await tool.invoke({ ticker: 'NVDA' });
            const parsed: NewsSentimentOutput = JSON.parse(result);

            expect(parsed.ticker).toBe('NVDA');
            expect(parsed.news_count).toBe(1);
            expect(parsed.x_sentiment).toBeDefined();
            expect(parsed.x_sentiment!.overall).toBe('bullish');
            expect(parsed.x_sentiment!.summary).toContain('chips are a hit');
            expect(parsed.x_sentiment!.sources).toHaveLength(1);
        });

        it('should handle X search failure gracefully', async () => {
            mockPolygonService.getTickerDetails.mockReturnValue(
                of(mockTickerDetails),
            );
            mockPolygonService.getTickerNews.mockReturnValue(of(mockArticles));
            mockGrokService.generateContent.mockResolvedValue(mockGrokResponse);
            mockGrokService.generateWithXSearch.mockRejectedValue(
                new Error('X search failed'),
            );

            const tool = createNewsSentimentTool(mockPolygonService, mockGrokService);
            const result = await tool.invoke({ ticker: 'NVDA' });
            const parsed: NewsSentimentOutput = JSON.parse(result);

            expect(parsed.ticker).toBe('NVDA');
            expect(parsed.news_count).toBe(1);
            expect(parsed.x_sentiment).toBeUndefined();
        });

        it('should return result if only X data is available', async () => {
            mockPolygonService.getTickerDetails.mockReturnValue(
                of(mockTickerDetails),
            );
            mockPolygonService.getTickerNews.mockReturnValue(of([]));
            mockGrokService.generateWithXSearch.mockResolvedValue(mockXData);
            // generateContent might still be called if there are no articles?
            // In current implementation, if articles.length === 0, it skips buildSentimentPrompt and generateContent for news.

            const tool = createNewsSentimentTool(mockPolygonService, mockGrokService);
            const result = await tool.invoke({ ticker: 'NVDA' });
            const parsed: NewsSentimentOutput = JSON.parse(result);

            expect(parsed.ticker).toBe('NVDA');
            expect(parsed.news_count).toBe(0);
            expect(parsed.x_sentiment).toBeDefined();
            expect(parsed.x_sentiment!.overall).toBe('bullish');
        });
    });
});
