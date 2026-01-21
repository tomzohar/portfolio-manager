import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { FredService } from '../../assets/services/fred.service';
import { NewsService } from '../../assets/services/news.service';
import { GeminiLlmService } from '../services/gemini-llm.service';
import { FredDataPoint } from '../../assets/types/fred-api.types';
import { NewsArticle } from '../../assets/types/news-api.types';
import { firstValueFrom } from 'rxjs';

/**
 * Macro Analyst Tool
 *
 * Provides macroeconomic context by fetching FRED indicators (CPI, GDP, Yield Curve, VIX, Unemployment)
 * and recent macro news, then uses Gemini LLM to classify market regime.
 *
 * Following TDD principles and NestJS best practices.
 */

export type MarketRegimeStatus = 'Inflationary' | 'Deflationary' | 'Goldilocks';
export type RiskSignal = 'Risk-On' | 'Risk-Off';

export interface MacroIndicators {
  cpi_yoy: number | null;
  gdp_growth: number | null;
  yield_spread: number | null;
  vix: number | null;
  unemployment: number | null;
  date: string;
}

export interface MarketRegime {
  status: MarketRegimeStatus;
  signal: RiskSignal;
  key_driver: string;
  confidence: number;
}

export interface MacroAnalysisResult {
  regime?: MarketRegime;
  indicators?: MacroIndicators;
  news_count?: number;
  error?: string;
}

/**
 * FRED Series IDs for macroeconomic indicators
 */
const FRED_SERIES = {
  CPI: 'CPIAUCSL', // Consumer Price Index for All Urban Consumers
  GDP: 'GDP', // Gross Domestic Product
  YIELD_CURVE: 'T10Y2Y', // 10-Year Treasury Minus 2-Year Treasury
  VIX: 'VIXCLS', // CBOE Volatility Index
  UNEMPLOYMENT: 'UNRATE', // Unemployment Rate
};

/**
 * Create the Macro Analyst Tool
 *
 * @param fredService - Injected FredService for fetching economic data
 * @param newsService - Injected NewsService for fetching macro news
 * @param geminiService - Injected GeminiLlmService for regime classification
 * @returns DynamicStructuredTool for LangGraph
 */
export function createMacroAnalystTool(
  fredService: FredService,
  newsService: NewsService,
  geminiService: GeminiLlmService,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'macro_analyst',
    description:
      'Analyzes macroeconomic indicators (CPI, GDP, Yield Curve, VIX, Unemployment) and recent news to classify the current market regime. ' +
      'Returns market regime classification (Inflationary/Deflationary/Goldilocks) and risk signal (Risk-On/Risk-Off).',
    schema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          'Optional search query for macro-related news (default: "economy market")',
        ),
    }),
    func: async ({ query = 'economy market' }: { query?: string }) => {
      try {
        // 1. Fetch macroeconomic indicators from FRED
        const indicators = await fetchMacroIndicators(fredService);

        // 2. Fetch recent macro news
        let news: NewsArticle[] = [];
        try {
          const newsObservable = newsService.searchNews(query);
          news = await firstValueFrom(newsObservable);
        } catch (error) {
          // News fetch is optional - continue without it
          console.warn('Failed to fetch macro news:', error);
        }

        // 3. Check if we have enough data to proceed
        if (!indicators.cpi_yoy && !indicators.gdp_growth && !indicators.vix) {
          const errorResult: MacroAnalysisResult = {
            error:
              'Insufficient economic data available. Unable to determine market regime.',
          };
          return JSON.stringify(errorResult);
        }

        // 4. Build LLM prompt
        const prompt = buildMacroAnalysisPrompt(indicators, news);

        // 5. Call Gemini LLM
        const llmResponse = await geminiService.generateContent(prompt);

        // 6. Parse response into MarketRegime
        const regime = parseMarketRegime(llmResponse.text);

        const result: MacroAnalysisResult = {
          regime,
          indicators,
          news_count: news.length,
        };

        return JSON.stringify(result);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const errorResult: MacroAnalysisResult = {
          error: `Failed to analyze macro environment: ${errorMessage}`,
        };
        return JSON.stringify(errorResult);
      }
    },
  });
}

/**
 * Fetch all macroeconomic indicators from FRED
 *
 * @param fredService - FredService instance
 * @returns MacroIndicators with calculated values
 */
async function fetchMacroIndicators(
  fredService: FredService,
): Promise<MacroIndicators> {
  const now = new Date();
  const date = now.toISOString().split('T')[0] ?? '';

  // Fetch all series in parallel
  const [cpiData, gdpData, yieldData, vixData, unemploymentData] =
    await Promise.all([
      fetchSeries(fredService, FRED_SERIES.CPI),
      fetchSeries(fredService, FRED_SERIES.GDP),
      fetchSeries(fredService, FRED_SERIES.YIELD_CURVE),
      fetchSeries(fredService, FRED_SERIES.VIX),
      fetchSeries(fredService, FRED_SERIES.UNEMPLOYMENT),
    ]);

  // Calculate CPI Year-over-Year change
  const cpiYoy = calculateYoYChange(cpiData);

  // Calculate GDP Quarter-over-Quarter growth
  const gdpGrowth = calculateQoQGrowth(gdpData);

  // Get latest yield curve spread (already in percentage points)
  const yieldSpread = getLatestValue(yieldData);
  const yieldSpreadBps = yieldSpread !== null ? yieldSpread * 100 : null;

  // Get latest VIX
  const vix = getLatestValue(vixData);

  // Get latest unemployment rate
  const unemployment = getLatestValue(unemploymentData);

  return {
    cpi_yoy: cpiYoy,
    gdp_growth: gdpGrowth,
    yield_spread: yieldSpreadBps,
    vix,
    unemployment,
    date,
  };
}

/**
 * Fetch a FRED series, returning null on error
 *
 * @param fredService - FredService instance
 * @param seriesId - FRED series ID
 * @returns Array of data points or null
 */
async function fetchSeries(
  fredService: FredService,
  seriesId: string,
): Promise<FredDataPoint[] | null> {
  try {
    const observable = fredService.getSeries(seriesId);
    return await firstValueFrom(observable);
  } catch (error) {
    console.warn(`Failed to fetch FRED series ${seriesId}:`, error);
    return null;
  }
}

/**
 * Calculate year-over-year percentage change for CPI
 *
 * @param data - Array of FRED data points
 * @returns YoY percentage change or null
 */
function calculateYoYChange(data: FredDataPoint[] | null): number | null {
  if (!data || data.length < 13) {
    return null;
  }

  const latest = data[data.length - 1]?.value;
  const yearAgo = data[data.length - 13]?.value;

  if (latest === undefined || yearAgo === undefined || yearAgo === 0) {
    return null;
  }

  const yoyChange = ((latest - yearAgo) / yearAgo) * 100;
  return Number(yoyChange.toFixed(2));
}

/**
 * Calculate quarter-over-quarter growth for GDP
 *
 * @param data - Array of FRED data points
 * @returns QoQ percentage growth or null
 */
function calculateQoQGrowth(data: FredDataPoint[] | null): number | null {
  if (!data || data.length < 2) {
    return null;
  }

  const latest = data[data.length - 1]?.value;
  const previous = data[data.length - 2]?.value;

  if (latest === undefined || previous === undefined || previous === 0) {
    return null;
  }

  const qoqGrowth = ((latest - previous) / previous) * 100;
  return Number(qoqGrowth.toFixed(2));
}

/**
 * Get the latest value from a FRED series
 *
 * @param data - Array of FRED data points
 * @returns Latest value or null
 */
function getLatestValue(data: FredDataPoint[] | null): number | null {
  if (!data || data.length === 0) {
    return null;
  }

  return data[data.length - 1]?.value ?? null;
}

/**
 * Build LLM prompt for macro analysis
 *
 * @param indicators - MacroIndicators data
 * @param news - Array of news articles
 * @returns Formatted prompt string
 */
function buildMacroAnalysisPrompt(
  indicators: MacroIndicators,
  news: NewsArticle[],
): string {
  const systemPrompt = `You are a Senior Macroeconomic Analyst specializing in market regime classification.

Your task: Analyze the provided economic indicators and classify the current market regime.

Available Regimes:
1. Inflationary - Rising CPI (>3% YoY), favors real assets
2. Deflationary - Falling GDP + rising unemployment, favors bonds/cash
3. Goldilocks - Moderate growth + low inflation, favors growth stocks

Risk Signals:
- Risk-On: VIX < 20, positive yield curve, low unemployment
- Risk-Off: VIX > 20, inverted yield curve, rising unemployment

Output Format (JSON):
{
  "status": "Inflationary" | "Deflationary" | "Goldilocks",
  "signal": "Risk-On" | "Risk-Off",
  "key_driver": "Brief explanation of primary macro factor",
  "confidence": 0.0-1.0
}

Be concise, data-driven, and avoid speculation.`;

  // Helper function to format values, handling null gracefully
  const fmt = (value: number | null, suffix = ''): string => {
    if (value === null) {
      return 'N/A';
    }
    return `${value.toFixed(2)}${suffix}`;
  };

  let userPrompt = `Analyze the current market regime based on these indicators:

CPI (YoY): ${fmt(indicators.cpi_yoy, '%')}
GDP Growth (QoQ): ${fmt(indicators.gdp_growth, '%')}
Yield Curve (10Y-2Y): ${fmt(indicators.yield_spread, ' bps')}
VIX: ${fmt(indicators.vix)}
Unemployment: ${fmt(indicators.unemployment, '%')}

Date: ${indicators.date}

Note: Some indicators may show as N/A if data is temporarily unavailable.`;

  // Add news context if available
  if (news.length > 0) {
    const newsSnippets = news
      .slice(0, 5) // Top 5 articles
      .map((article, idx) => `${idx + 1}. ${article.title}: ${article.snippet}`)
      .join('\n');

    userPrompt += `\n\nRecent Economic News:\n${newsSnippets}`;
  }

  userPrompt += '\n\nProvide your analysis in JSON format.';

  return `${systemPrompt}\n\n${userPrompt}`;
}

/**
 * Parse LLM response into MarketRegime
 *
 * @param llmResponse - Raw LLM response string
 * @returns MarketRegime object
 */
function parseMarketRegime(llmResponse: string): MarketRegime {
  try {
    // Clean the response
    let responseClean = llmResponse.trim();

    // Handle markdown code blocks
    if (responseClean.includes('```json')) {
      const start = responseClean.indexOf('```json') + 7;
      const end = responseClean.indexOf('```', start);
      responseClean = responseClean.substring(start, end).trim();
    } else if (responseClean.includes('```')) {
      const start = responseClean.indexOf('```') + 3;
      const end = responseClean.indexOf('```', start);
      responseClean = responseClean.substring(start, end).trim();
    }

    // Parse JSON
    const data = JSON.parse(responseClean) as {
      status?: string;
      signal?: string;
      key_driver?: string;
      confidence?: number;
    };

    // Validate and construct regime
    const regime: MarketRegime = {
      status: validateRegimeStatus(data.status),
      signal: validateRiskSignal(data.signal),
      key_driver: data.key_driver || 'Unable to determine key driver',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.8,
    };

    return regime;
  } catch (error) {
    console.warn(
      'Failed to parse LLM response, using conservative default:',
      error,
    );

    // Fallback to conservative regime
    return {
      status: 'Goldilocks',
      signal: 'Risk-Off',
      key_driver:
        'Unable to parse economic data, defaulting to conservative stance',
      confidence: 0.3,
    };
  }
}

/**
 * Validate and normalize regime status
 *
 * @param status - Raw status string
 * @returns Valid MarketRegimeStatus
 */
function validateRegimeStatus(status?: string): MarketRegimeStatus {
  const validStatuses: MarketRegimeStatus[] = [
    'Inflationary',
    'Deflationary',
    'Goldilocks',
  ];

  if (status && validStatuses.includes(status as MarketRegimeStatus)) {
    return status as MarketRegimeStatus;
  }

  return 'Goldilocks'; // Conservative default
}

/**
 * Validate and normalize risk signal
 *
 * @param signal - Raw signal string
 * @returns Valid RiskSignal
 */
function validateRiskSignal(signal?: string): RiskSignal {
  const validSignals: RiskSignal[] = ['Risk-On', 'Risk-Off'];

  if (signal && validSignals.includes(signal as RiskSignal)) {
    return signal as RiskSignal;
  }

  return 'Risk-Off'; // Conservative default
}
