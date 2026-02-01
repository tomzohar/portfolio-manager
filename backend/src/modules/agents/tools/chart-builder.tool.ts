import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { firstValueFrom } from 'rxjs';
import { TechnicalIndicatorsService } from '../../assets/services/technical-indicators.service';
import { OHLCVBar } from '../../assets/types/polygon-api.types';
import { A2UIComponent } from '../types/a2ui.types';
import { UISurfaceService } from '../services/ui-surface.service';
import { A2UICatalogService } from '../services/a2ui-catalog.service';
import { Logger } from '@nestjs/common';

const logger = new Logger('ChartBuilderTool');

export const ChartBuilderSchema = z.object({
  ticker: z
    .string()
    .toUpperCase()
    .describe('Stock ticker symbol (e.g., AAPL, MSFT)'),
  timeframe: z
    .enum(['1M', '3M', '6M', '1Y', 'YTD', 'MAX'])
    .default('3M')
    .describe('Timeframe for the chart (default: 3M)'),
  type: z
    .enum(['candlestick', 'line', 'area', 'bar'])
    .default('candlestick')
    .describe('Type of chart to build (default: candlestick)'),
  indicators: z
    .array(z.string())
    .optional()
    .describe(
      'List of technical indicators to include (e.g., ["50 SMA", "200 SMA", "MACD"])',
    ),
});

export type ChartBuilderInput = z.infer<typeof ChartBuilderSchema>;

/**
 * Chart Builder Tool
 * Builds chart data configurations to be passed to manage_ui_surface.
 */
export function createChartBuilderTool(
  polygonService: PolygonApiService,
  indicatorService: TechnicalIndicatorsService,
  uiSurfaceService?: UISurfaceService, // Optional for backward compatibility/testing
  catalogService?: A2UICatalogService, // Optional for backward compatibility/testing
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'chart_builder',
    description:
      'Generates interactive financial charts (Price, SMA, MACD, etc). ' +
      'AUTOMATICALLY creates a UI surface and returns a reference ID. ' +
      'Simply report the surface ID and embed the <a2ui-surface> tag in your final response.',
    schema: ChartBuilderSchema,
    func: async (
      {
        ticker,
        timeframe = '3M',
        type = 'candlestick',
        indicators = [],
      }: ChartBuilderInput,
      _runManager,
      config,
    ) => {
      try {
        const userId = config?.configurable?.userId as string;
        const threadId = config?.configurable?.thread_id as string;
        // 1. Determine lookback and period
        const periodDays = mapTimeframeToDays(timeframe);
        const maxIndicatorLookback = getRequiredLookback(indicators);
        const { from, to } = indicatorService.calculateDateRange(
          periodDays,
          maxIndicatorLookback,
        );

        // 2. Fetch data
        // 2. Fetch data
        const barsDesc = await firstValueFrom(
          polygonService.getAggregates(ticker, from, to, 'day', 1, 'desc'),
        );

        if (!barsDesc || barsDesc.length === 0) {
          throw new Error(`No data available for ticker ${ticker}`);
        }

        const allBars = [...barsDesc].reverse();

        // 3. Filter data for the requested timeframe vs lookback
        // The requested data usually starts from 'now - periodDays'
        const requestedStartDate = new Date();
        requestedStartDate.setDate(requestedStartDate.getDate() - periodDays);

        const chartBars = allBars.filter(
          (bar) => bar.timestamp >= requestedStartDate,
        );

        // 4. Calculate indicators
        const dataModel: Record<string, any> = {};
        const series: any[] = [];

        // Main price series
        if (type === 'candlestick') {
          dataModel['priceSeries'] = chartBars.map((bar) => ({
            x: bar.timestamp.getTime(),
            y: [bar.open, bar.high, bar.low, bar.close],
          }));
          series.push({
            name: 'Price',
            type: 'candlestick',
            data: '/priceSeries',
          });
        } else {
          dataModel['priceSeries'] = chartBars.map((bar) => ({
            x: bar.timestamp.getTime(),
            y: bar.close,
          }));
          series.push({
            name: 'Price',
            type: type,
            data: '/priceSeries',
          });
        }

        // Add Indicators
        for (const indicator of indicators) {
          const lowerIndicator = indicator.toLowerCase();

          if (lowerIndicator.includes('sma')) {
            const period =
              parseInt(lowerIndicator.replace(/[^0-9]/g, '')) || 50;
            const fullSma = calculateSMA(allBars, period);
            // Align with chartBars
            const alignedSma = alignSeries(allBars, fullSma, chartBars);
            const key = `sma${period}Series`;
            dataModel[key] = alignedSma;
            series.push({
              name: `${period} SMA`,
              type: 'line',
              data: `/${key}`,
            });
          }

          if (lowerIndicator.includes('macd')) {
            // MACD is usually shown on a separate pane, but for this simple tool
            // we'll just add the MACD line if requested.
            // In a more complex version we might return multiple components.
            // For now let's just do SMA as priority.
          }
        }

        // 5. Construct Component
        const chartComponent: A2UIComponent = {
          component: 'Chart',
          props: {
            type: (type === 'candlestick' ? 'line' : type) as
              | 'line'
              | 'bar'
              | 'pie'
              | 'area',
            height: 300,
            title: `${ticker} - ${timeframe} Chart`,
            options: {
              chart: {
                id: `${ticker}-chart`,
              },
              xaxis: {
                type: 'datetime',
              },
              // If candlestick, ApexCharts needs specific handling
              plotOptions:
                type === 'candlestick'
                  ? {
                      candlestick: {
                        colors: {
                          upward: '#26a69a',
                          downward: '#ef5350',
                        },
                      },
                    }
                  : undefined,
            },
          },
          bindings: {
            series: '/series',
          },
        };

        // UI Surface tool expects 'components' to be a stringified array
        // and 'dataModel' to be a stringified object.
        // Wait, manage-ui-surface.tool.ts:131 "components: z.string().optional().describe('JSON-encoded string array...')"

        dataModel['series'] = series;

        // NEW FLOW: Create surface directly if services are available and context exists
        if (uiSurfaceService && catalogService && userId && threadId) {
          const componentList = [chartComponent];

          // Validate
          catalogService.validateComponents(componentList);

          // Create Surface
          const surface = await uiSurfaceService.createSurface(
            userId,
            threadId,
            componentList,
            dataModel,
          );

          logger.log(
            `Created Chart Surface ${surface.id} for ${ticker} directly.`,
          );

          return JSON.stringify({
            status: 'success',
            message: `Chart created for ${ticker} (${timeframe}).`,
            surfaceId: surface.id,
            action: 'display_surface',
            display_instruction: `Embed <a2ui-surface id="${surface.id}" /> in your response.`,
          });
        }

        // FALLBACK: Old behavior (return huge JSON) if services missing
        // This keeps it compatible if used elsewhere without injection
        logger.warn(
          'UISurfaceService not injected or missing context - returning raw payload (High Token Usage Warning)',
        );

        const result = {
          action: 'create',
          components: JSON.stringify([chartComponent]),
          dataModel: JSON.stringify(dataModel),
        };

        return JSON.stringify({
          status: 'success',
          message: `Chart configuration generated for ${ticker}.`,
          ...result,
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Chart Builder failed: ${errorMessage}`);
        return JSON.stringify({ status: 'error', message: errorMessage });
      }
    },
  });
}

// --- Internal Helpers ---

function mapTimeframeToDays(timeframe: string): number {
  switch (timeframe) {
    case '1M':
      return 30;
    case '3M':
      return 90;
    case '6M':
      return 180;
    case '1Y':
      return 365;
    case 'YTD': {
      const start = new Date(new Date().getFullYear(), 0, 1);
      const diff = new Date().getTime() - start.getTime();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
    case 'MAX':
      return 5 * 365; // Let's limit to 5 years for now
    default:
      return 90;
  }
}

function getRequiredLookback(indicators: string[]): number {
  let max = 0;
  for (const ind of indicators) {
    const period = parseInt(ind.replace(/[^0-9]/g, ''));
    if (!isNaN(period) && period > max) max = period;
  }
  // Indicators often need more data points than their period (e.g. for stabilization)
  return Math.max(max * 1.5, 20);
}

function calculateSMA(bars: OHLCVBar[], period: number): number[] {
  const closes = bars.map((b) => b.close);
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

function alignSeries(
  allBars: OHLCVBar[],
  values: number[],
  chartBars: OHLCVBar[],
): { x: number; y: number | null }[] {
  const chartStartTimestamp = chartBars[0].timestamp.getTime();
  const aligned: { x: number; y: number | null }[] = [];

  for (let i = 0; i < allBars.length; i++) {
    const ts = allBars[i].timestamp.getTime();
    if (ts >= chartStartTimestamp) {
      aligned.push({
        x: ts,
        y: isNaN(values[i]) ? null : Number(values[i].toFixed(2)),
      });
    }
  }
  return aligned;
}
