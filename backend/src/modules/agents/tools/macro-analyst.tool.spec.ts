import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { FredService } from '../../assets/services/fred.service';
import { NewsService } from '../../assets/services/news.service';
import { GeminiLlmService } from '../services/gemini-llm.service';
import { FredDataPoint } from '../../assets/types/fred-api.types';
import { NewsArticle } from '../../assets/types/news-api.types';
import { createMacroAnalystTool } from './macro-analyst.tool';

describe('MacroAnalystTool', () => {
  let fredService: jest.Mocked<FredService>;
  let newsService: jest.Mocked<NewsService>;
  let geminiService: jest.Mocked<GeminiLlmService>;
  let tool: ReturnType<typeof createMacroAnalystTool>;

  // Mock FRED data fixtures
  const mockCpiData: FredDataPoint[] = generateFredSeriesData(24, 300, 1.5); // 2 years, starting at 300, 1.5% monthly growth
  const mockGdpData: FredDataPoint[] = generateFredSeriesData(8, 20000, 0.5); // 2 years quarterly, starting at $20T
  const mockYieldCurveData: FredDataPoint[] = generateFredSeriesData(
    30,
    0.5,
    0.01,
  ); // 30 days, 50 bps positive spread
  const mockVixData: FredDataPoint[] = generateFredSeriesData(30, 18, 0.5); // 30 days, VIX at 18
  const mockUnemploymentData: FredDataPoint[] = generateFredSeriesData(
    12,
    4.2,
    0.05,
  ); // 1 year, 4.2% unemployment

  // Mock news fixtures
  const mockNews: NewsArticle[] = [
    {
      title: 'Fed Holds Rates Steady Amid Inflation Concerns',
      snippet:
        'The Federal Reserve maintained interest rates as inflation remains above target...',
      link: 'https://example.com/fed-rates',
      publishedDate: '2024-01-10',
    },
    {
      title: 'GDP Growth Exceeds Expectations',
      snippet: 'U.S. economy grew at 2.5% annual rate in latest quarter...',
      link: 'https://example.com/gdp',
      publishedDate: '2024-01-09',
    },
    {
      title: 'Job Market Remains Strong',
      snippet: 'Unemployment rate holds at 4.2% as hiring continues...',
      link: 'https://example.com/jobs',
      publishedDate: '2024-01-08',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: FredService,
          useValue: {
            getSeries: jest.fn(),
          },
        },
        {
          provide: NewsService,
          useValue: {
            searchNews: jest.fn(),
          },
        },
        {
          provide: GeminiLlmService,
          useValue: {
            generateContent: jest.fn(),
          },
        },
      ],
    }).compile();

    fredService = module.get(FredService);
    newsService = module.get(NewsService);
    geminiService = module.get(GeminiLlmService);
    tool = createMacroAnalystTool(fredService, newsService, geminiService);
  });

  describe('Happy Path - All Data Available', () => {
    beforeEach(() => {
      // Mock all FRED series to return data
      fredService.getSeries.mockImplementation((seriesId: string) => {
        switch (seriesId) {
          case 'CPIAUCSL':
            return of(mockCpiData);
          case 'GDP':
            return of(mockGdpData);
          case 'T10Y2Y':
            return of(mockYieldCurveData);
          case 'VIXCLS':
            return of(mockVixData);
          case 'UNRATE':
            return of(mockUnemploymentData);
          default:
            return of([]);
        }
      });

      newsService.searchNews.mockReturnValue(of(mockNews));

      geminiService.generateContent.mockResolvedValue({
        text: JSON.stringify({
          status: 'Goldilocks',
          signal: 'Risk-On',
          key_driver: 'Moderate growth with controlled inflation',
          confidence: 0.85,
        }),
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });
    });

    it('should return valid market regime classification', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        regime: {
          status: string;
          signal: string;
          key_driver: string;
          confidence: number;
        };
        indicators: unknown;
        news_count: number;
      };

      expect(parsedResult.regime).toBeDefined();
      expect(parsedResult.regime.status).toBe('Goldilocks');
      expect(parsedResult.regime.signal).toBe('Risk-On');
      expect(parsedResult.regime.key_driver).toBe(
        'Moderate growth with controlled inflation',
      );
      expect(parsedResult.regime.confidence).toBe(0.85);
    });

    it('should fetch all required FRED series', async () => {
      await tool.func({});

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(fredService.getSeries).toHaveBeenCalledWith('CPIAUCSL');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(fredService.getSeries).toHaveBeenCalledWith('GDP');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(fredService.getSeries).toHaveBeenCalledWith('T10Y2Y');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(fredService.getSeries).toHaveBeenCalledWith('VIXCLS');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(fredService.getSeries).toHaveBeenCalledWith('UNRATE');
    });

    it('should include calculated indicators in result', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        indicators: {
          cpi_yoy: number;
          gdp_growth: number;
          yield_spread: number;
          vix: number;
          unemployment: number;
          date: string;
        };
      };

      expect(parsedResult.indicators).toBeDefined();
      expect(parsedResult.indicators.cpi_yoy).toBeDefined();
      expect(parsedResult.indicators.gdp_growth).toBeDefined();
      expect(parsedResult.indicators.yield_spread).toBeDefined();
      expect(parsedResult.indicators.vix).toBeDefined();
      expect(parsedResult.indicators.unemployment).toBeDefined();
      expect(parsedResult.indicators.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should include news count in result', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as { news_count: number };

      expect(parsedResult.news_count).toBe(3);
    });

    it('should call Gemini with properly formatted prompt', async () => {
      await tool.func({});

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(geminiService.generateContent).toHaveBeenCalled();
      const callArgs = (geminiService.generateContent as jest.Mock).mock
        .calls[0] as [string];
      const prompt = callArgs[0];

      expect(prompt).toContain('Senior Macroeconomic Analyst');
      expect(prompt).toContain('CPI (YoY)');
      expect(prompt).toContain('GDP Growth (QoQ)');
      expect(prompt).toContain('Yield Curve (10Y-2Y)');
      expect(prompt).toContain('VIX');
      expect(prompt).toContain('Unemployment');
    });
  });

  describe('Market Regime Classifications', () => {
    beforeEach(() => {
      fredService.getSeries.mockImplementation((seriesId: string) => {
        switch (seriesId) {
          case 'CPIAUCSL':
            return of(mockCpiData);
          case 'GDP':
            return of(mockGdpData);
          case 'T10Y2Y':
            return of(mockYieldCurveData);
          case 'VIXCLS':
            return of(mockVixData);
          case 'UNRATE':
            return of(mockUnemploymentData);
          default:
            return of([]);
        }
      });
      newsService.searchNews.mockReturnValue(of(mockNews));
    });

    it('should classify Inflationary regime correctly', async () => {
      geminiService.generateContent.mockResolvedValue({
        text: JSON.stringify({
          status: 'Inflationary',
          signal: 'Risk-On',
          key_driver: 'Rising CPI above 3% favoring real assets',
          confidence: 0.9,
        }),
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        regime: { status: string; signal: string };
      };

      expect(parsedResult.regime.status).toBe('Inflationary');
      expect(parsedResult.regime.signal).toBe('Risk-On');
    });

    it('should classify Deflationary regime correctly', async () => {
      geminiService.generateContent.mockResolvedValue({
        text: JSON.stringify({
          status: 'Deflationary',
          signal: 'Risk-Off',
          key_driver: 'Falling GDP and rising unemployment',
          confidence: 0.85,
        }),
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        regime: { status: string; signal: string };
      };

      expect(parsedResult.regime.status).toBe('Deflationary');
      expect(parsedResult.regime.signal).toBe('Risk-Off');
    });

    it('should classify Goldilocks regime correctly', async () => {
      geminiService.generateContent.mockResolvedValue({
        text: JSON.stringify({
          status: 'Goldilocks',
          signal: 'Risk-On',
          key_driver: 'Moderate growth with low inflation',
          confidence: 0.88,
        }),
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        regime: { status: string; signal: string };
      };

      expect(parsedResult.regime.status).toBe('Goldilocks');
      expect(parsedResult.regime.signal).toBe('Risk-On');
    });
  });

  describe('Risk Signal Determination', () => {
    beforeEach(() => {
      fredService.getSeries.mockImplementation((seriesId: string) => {
        switch (seriesId) {
          case 'CPIAUCSL':
            return of(mockCpiData);
          case 'GDP':
            return of(mockGdpData);
          case 'T10Y2Y':
            return of(mockYieldCurveData);
          case 'VIXCLS':
            return of(mockVixData);
          case 'UNRATE':
            return of(mockUnemploymentData);
          default:
            return of([]);
        }
      });
      newsService.searchNews.mockReturnValue(of(mockNews));
    });

    it('should determine Risk-On signal (VIX < 20, positive yield curve)', async () => {
      geminiService.generateContent.mockResolvedValue({
        text: JSON.stringify({
          status: 'Goldilocks',
          signal: 'Risk-On',
          key_driver: 'Low volatility and positive economic outlook',
          confidence: 0.85,
        }),
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        regime: { signal: string };
      };

      expect(parsedResult.regime.signal).toBe('Risk-On');
    });

    it('should determine Risk-Off signal (VIX > 20, inverted yield curve)', async () => {
      // Override VIX to be high and yield curve to be inverted
      fredService.getSeries.mockImplementation((seriesId: string) => {
        switch (seriesId) {
          case 'CPIAUCSL':
            return of(mockCpiData);
          case 'GDP':
            return of(mockGdpData);
          case 'T10Y2Y':
            return of(generateFredSeriesData(30, -0.2, 0.01)); // Inverted curve
          case 'VIXCLS':
            return of(generateFredSeriesData(30, 25, 0.5)); // VIX at 25
          case 'UNRATE':
            return of(mockUnemploymentData);
          default:
            return of([]);
        }
      });

      geminiService.generateContent.mockResolvedValue({
        text: JSON.stringify({
          status: 'Deflationary',
          signal: 'Risk-Off',
          key_driver: 'Elevated market fear and inverted yield curve',
          confidence: 0.9,
        }),
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        regime: { signal: string };
      };

      expect(parsedResult.regime.signal).toBe('Risk-Off');
    });
  });

  describe('Partial Data Handling', () => {
    it('should handle missing CPI data gracefully', async () => {
      fredService.getSeries.mockImplementation((seriesId: string) => {
        if (seriesId === 'CPIAUCSL') {
          return of([]);
        }
        switch (seriesId) {
          case 'GDP':
            return of(mockGdpData as unknown as FredDataPoint[]);
          case 'T10Y2Y':
            return of(mockYieldCurveData as unknown as FredDataPoint[]);
          case 'VIXCLS':
            return of(mockVixData as unknown as FredDataPoint[]);
          case 'UNRATE':
            return of(mockUnemploymentData as unknown as FredDataPoint[]);
          default:
            return of([]);
        }
      });

      newsService.searchNews.mockReturnValue(of(mockNews));
      geminiService.generateContent.mockResolvedValue({
        text: JSON.stringify({
          status: 'Goldilocks',
          signal: 'Risk-On',
          key_driver: 'Analysis based on available indicators',
          confidence: 0.7,
        }),
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        indicators: { cpi_yoy: number | null };
      };

      expect(parsedResult.indicators.cpi_yoy).toBeNull();

      // Verify prompt contains N/A
      const callArgs = (geminiService.generateContent as jest.Mock).mock
        .calls[0] as [string];
      const prompt = callArgs[0];
      expect(prompt).toContain('N/A');
    });

    it('should proceed with available indicators when some are missing', async () => {
      fredService.getSeries.mockImplementation((seriesId: string) => {
        if (seriesId === 'CPIAUCSL' || seriesId === 'GDP') {
          return of([]);
        }
        switch (seriesId) {
          case 'T10Y2Y':
            return of(mockYieldCurveData as unknown as FredDataPoint[]);
          case 'VIXCLS':
            return of(mockVixData as unknown as FredDataPoint[]);
          case 'UNRATE':
            return of(mockUnemploymentData as unknown as FredDataPoint[]);
          default:
            return of([]);
        }
      });

      newsService.searchNews.mockReturnValue(of(mockNews));
      geminiService.generateContent.mockResolvedValue({
        text: JSON.stringify({
          status: 'Goldilocks',
          signal: 'Risk-Off',
          key_driver: 'Limited data available, conservative assessment',
          confidence: 0.6,
        }),
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as { regime: unknown };

      expect(parsedResult.regime).toBeDefined();
    });

    it('should return error when all critical indicators are missing', async () => {
      fredService.getSeries.mockReturnValue(of([]));
      newsService.searchNews.mockReturnValue(of(mockNews));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as { error: string };

      expect(parsedResult.error).toBeDefined();
      expect(parsedResult.error).toContain('Insufficient economic data');
    });
  });

  describe('News Integration', () => {
    beforeEach(() => {
      fredService.getSeries.mockImplementation((seriesId: string) => {
        switch (seriesId) {
          case 'CPIAUCSL':
            return of(mockCpiData);
          case 'GDP':
            return of(mockGdpData);
          case 'T10Y2Y':
            return of(mockYieldCurveData);
          case 'VIXCLS':
            return of(mockVixData);
          case 'UNRATE':
            return of(mockUnemploymentData);
          default:
            return of([]);
        }
      });

      geminiService.generateContent.mockResolvedValue({
        text: JSON.stringify({
          status: 'Goldilocks',
          signal: 'Risk-On',
          key_driver: 'Moderate growth',
          confidence: 0.85,
        }),
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });
    });

    it('should fetch and include news in prompt', async () => {
      newsService.searchNews.mockReturnValue(of(mockNews));

      await tool.func({ query: 'economy market' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(newsService.searchNews).toHaveBeenCalledWith('economy market');

      const callArgs = (geminiService.generateContent as jest.Mock).mock
        .calls[0] as [string];
      const prompt = callArgs[0];
      expect(prompt).toContain('Recent Economic News');
      expect(prompt).toContain('Fed Holds Rates Steady');
    });

    it('should use custom news query when provided', async () => {
      newsService.searchNews.mockReturnValue(of(mockNews));

      await tool.func({ query: 'inflation federal reserve' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(newsService.searchNews).toHaveBeenCalledWith(
        'inflation federal reserve',
      );
    });

    it('should proceed without news if news service fails', async () => {
      newsService.searchNews.mockReturnValue(
        throwError(() => new Error('News API error')),
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as { news_count: number };

      expect(parsedResult.news_count).toBe(0);
      // Should still have regime classification
      expect(parsedResult).toHaveProperty('regime');
    });
  });

  describe('LLM Parsing Edge Cases', () => {
    beforeEach(() => {
      fredService.getSeries.mockImplementation((seriesId: string) => {
        switch (seriesId) {
          case 'CPIAUCSL':
            return of(mockCpiData);
          case 'GDP':
            return of(mockGdpData);
          case 'T10Y2Y':
            return of(mockYieldCurveData);
          case 'VIXCLS':
            return of(mockVixData);
          case 'UNRATE':
            return of(mockUnemploymentData);
          default:
            return of([]);
        }
      });
      newsService.searchNews.mockReturnValue(of(mockNews));
    });

    it('should parse JSON wrapped in markdown code blocks', async () => {
      geminiService.generateContent.mockResolvedValue({
        text: `\`\`\`json
{
  "status": "Inflationary",
  "signal": "Risk-On",
  "key_driver": "Rising prices",
  "confidence": 0.9
}
\`\`\``,
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        regime: { status: string };
      };

      expect(parsedResult.regime.status).toBe('Inflationary');
    });

    it('should handle malformed JSON with fallback', async () => {
      geminiService.generateContent.mockResolvedValue({
        text: 'This is not valid JSON at all',
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        regime: { status: string; signal: string; confidence: number };
      };

      // Should use conservative fallback
      expect(parsedResult.regime.status).toBe('Goldilocks');
      expect(parsedResult.regime.signal).toBe('Risk-Off');
      expect(parsedResult.regime.confidence).toBe(0.3);
    });

    it('should handle missing fields with defaults', async () => {
      geminiService.generateContent.mockResolvedValue({
        text: JSON.stringify({
          status: 'Inflationary',
          signal: 'Risk-On',
          // missing key_driver and confidence
        }),
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        regime: { key_driver: string; confidence: number };
      };

      expect(parsedResult.regime.key_driver).toBeDefined();
      expect(parsedResult.regime.confidence).toBe(0.8); // Default
    });

    it('should validate and normalize invalid regime status', async () => {
      geminiService.generateContent.mockResolvedValue({
        text: JSON.stringify({
          status: 'InvalidRegime',
          signal: 'Risk-On',
          key_driver: 'Test',
          confidence: 0.9,
        }),
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        regime: { status: string };
      };

      // Should default to Goldilocks for invalid status
      expect(parsedResult.regime.status).toBe('Goldilocks');
    });

    it('should validate and normalize invalid risk signal', async () => {
      geminiService.generateContent.mockResolvedValue({
        text: JSON.stringify({
          status: 'Inflationary',
          signal: 'InvalidSignal',
          key_driver: 'Test',
          confidence: 0.9,
        }),
        usage: { promptTokens: 500, completionTokens: 100, totalTokens: 600 },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as {
        regime: { signal: string };
      };

      // Should default to Risk-Off for invalid signal
      expect(parsedResult.regime.signal).toBe('Risk-Off');
    });
  });

  describe('Error Handling', () => {
    it('should handle FRED API errors', async () => {
      fredService.getSeries.mockReturnValue(
        throwError(() => new Error('FRED API Error')),
      );
      newsService.searchNews.mockReturnValue(of(mockNews));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as { error: string };

      expect(parsedResult.error).toBeDefined();
      expect(parsedResult.error).toContain('Insufficient economic data');
    });

    it('should handle Gemini LLM API errors', async () => {
      fredService.getSeries.mockImplementation((seriesId: string) => {
        switch (seriesId) {
          case 'CPIAUCSL':
            return of(mockCpiData);
          case 'GDP':
            return of(mockGdpData);
          case 'T10Y2Y':
            return of(mockYieldCurveData);
          case 'VIXCLS':
            return of(mockVixData);
          case 'UNRATE':
            return of(mockUnemploymentData);
          default:
            return of([]);
        }
      });
      newsService.searchNews.mockReturnValue(of(mockNews));
      geminiService.generateContent.mockRejectedValue(
        new Error('LLM API Error'),
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await tool.func({});
      const parsedResult = JSON.parse(String(result)) as { error: string };

      expect(parsedResult.error).toBeDefined();
      expect(parsedResult.error).toContain(
        'Failed to analyze macro environment',
      );
    });
  });
});

/**
 * Generate mock FRED series data
 *
 * @param points - Number of data points
 * @param startValue - Starting value
 * @param growth - Growth rate per period (as decimal)
 * @returns Array of FredDataPoint
 */
function generateFredSeriesData(
  points: number,
  startValue: number,
  growth: number,
): FredDataPoint[] {
  const data: FredDataPoint[] = [];
  const startDate = new Date('2022-01-01');

  for (let i = 0; i < points; i++) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i);

    const value = startValue * Math.pow(1 + growth / 100, i);

    data.push({
      date: date.toISOString().split('T')[0] ?? '',
      value: Number(value.toFixed(2)),
    });
  }

  return data;
}
