import { DynamicStructuredTool } from '@langchain/core/tools';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import { FinnhubApiService } from '../../assets/services/finnhub-api.service';
import { FinnhubEarningsSurprise } from '../../assets/types/finnhub-api.types';

export const EarningsCalendarSchema = z.object({
  symbol: z.string().optional().describe('Stock ticker symbol (e.g. AAPL)'),
  days_ahead: z
    .number()
    .default(30)
    .describe('Number of days to look ahead for upcoming earnings'),
  days_past: z
    .number()
    .default(30)
    .describe('Number of days to look back for recent earnings'),
});

export type EarningsCalendarInput = z.infer<typeof EarningsCalendarSchema>;

export interface EarningsCalendarResult {
  symbol?: string;
  upcoming_earnings: Array<{
    date: string;
    symbol: string;
    estimate_eps: number | null;
    hour: string;
    quarter: number;
    year: number;
    risk_level: 'Low' | 'Medium' | 'High';
    days_to_earnings: number;
  }>;
  recent_earnings: Array<{
    date: string;
    period: string;
    actual_eps: number | null;
    estimate_eps: number | null;
    surprise: number | null;
    surprise_percent: number | null;
  }>;
  summary: string;
}

export function createEarningsCalendarTool(finnhubService: FinnhubApiService) {
  return new DynamicStructuredTool({
    name: 'earnings_calendar',
    description:
      'Fetch upcoming and historical earnings dates, estimates, and surprise metrics for a stock ticker. Essential for assessing volatility risk before earnings.',
    schema: EarningsCalendarSchema,
    func: async (input: EarningsCalendarInput): Promise<string> => {
      const { symbol } = input;
      const days_ahead = input.days_ahead ?? 30;
      const days_past = input.days_past ?? 30;

      const today = new Date();

      const fromDate = new Date();
      fromDate.setDate(today.getDate() - days_past);

      const toDate = new Date();
      toDate.setDate(today.getDate() + days_ahead);

      const fromStr = fromDate.toISOString().split('T')[0];
      const toStr = toDate.toISOString().split('T')[0];

      try {
        // 1. Fetch Earnings Calendar (Upcoming & Historical dates)
        const calendarResponse = await firstValueFrom(
          finnhubService.getEarningsCalendar(fromStr, toStr, symbol),
        );

        const events = calendarResponse?.earningsCalendar || [];

        // 2. Fetch Earnings Surprises (Historical Accuracy)
        let surprises: FinnhubEarningsSurprise[] = [];
        if (symbol) {
          const surprisesResponse = await firstValueFrom(
            finnhubService.getEarningsSurprises(symbol),
          );
          surprises = surprisesResponse || [];
        }

        // Processing results
        const upcoming = events
          .filter(
            (e) =>
              new Date(e.date) >= new Date(today.toISOString().split('T')[0]),
          )
          .map((e) => {
            const eventDate = new Date(e.date);
            const diffDays = Math.ceil(
              (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
            );

            let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
            if (diffDays <= 2) riskLevel = 'High';
            else if (diffDays <= 7) riskLevel = 'Medium';

            return {
              date: e.date,
              symbol: e.symbol,
              estimate_eps: e.epsEstimate,
              hour: e.hour.toUpperCase(),
              quarter: e.quarter,
              year: e.year,
              risk_level: riskLevel,
              days_to_earnings: diffDays,
            };
          })
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          );

        const recent = surprises.map((s) => ({
          date: s.period,
          period: `${s.year} Q${s.quarter}`,
          actual_eps: s.actual,
          estimate_eps: s.estimate,
          surprise: s.surprise,
          surprise_percent: s.surprisePercent,
        }));

        let summary = '';
        if (symbol && upcoming.length > 0) {
          const next = upcoming[0];
          summary = `Next earnings for ${symbol} are on ${next.date} (${next.hour}) in ${next.days_to_earnings} days. Risk: ${next.risk_level}.`;
        } else if (symbol) {
          summary = `No upcoming earnings found for ${symbol} in the next ${days_ahead} days.`;
        } else {
          summary = `Found ${upcoming.length} upcoming earnings events across the market.`;
        }

        const result: EarningsCalendarResult = {
          symbol,
          upcoming_earnings: upcoming,
          recent_earnings: recent,
          summary,
        };

        return JSON.stringify(result, null, 2);
      } catch (error: unknown) {
        return `Error fetching earnings calendar data: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}
