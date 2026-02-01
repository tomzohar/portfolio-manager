/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { TechnicalIndicatorsService } from '../../assets/services/technical-indicators.service';
import { OHLCVBar } from '../../assets/types/polygon-api.types';
import { createChartBuilderTool } from './chart-builder.tool';

describe('ChartBuilderTool', () => {
  let polygonService: jest.Mocked<PolygonApiService>;
  let indicatorService: TechnicalIndicatorsService;
  let tool: ReturnType<typeof createChartBuilderTool>;

  const mockOHLCVData: OHLCVBar[] = generateMockOHLCVData(300);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TechnicalIndicatorsService,
        {
          provide: PolygonApiService,
          useValue: {
            getAggregates: jest.fn(),
          },
        },
      ],
    }).compile();

    polygonService = module.get(PolygonApiService);
    indicatorService = module.get(TechnicalIndicatorsService);
    tool = createChartBuilderTool(polygonService, indicatorService);
  });

  describe('chart building', () => {
    it('should generate a valid chart configuration for AAPL 3M', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      const result = await tool.func({
        ticker: 'AAPL',
        timeframe: '3M',
        type: 'candlestick',
      });

      const parsed = JSON.parse(String(result)) as {
        status: string;
        action: string;
        components: string;
        dataModel: string;
      };
      expect(parsed.status).toBe('success');
      expect(parsed.action).toBe('create');

      const components = JSON.parse(parsed.components) as any[];
      expect(components[0].component).toBe('Chart');
      expect(components[0].props.title).toContain('3M');

      const dataModel = JSON.parse(parsed.dataModel) as {
        series: any[];
        priceSeries: any[];
      };
      expect(dataModel.series).toBeDefined();
      expect(dataModel.priceSeries).toBeDefined();
      expect(dataModel.series[0].name).toBe('Price');
    });

    it('should include SMA indicators when requested', async () => {
      polygonService.getAggregates.mockReturnValue(of(mockOHLCVData));

      const result = await tool.func({
        ticker: 'AAPL',
        timeframe: '1M',
        indicators: ['50 SMA'],
      });

      const parsed = JSON.parse(String(result)) as { dataModel: string };
      const dataModel = JSON.parse(parsed.dataModel) as {
        series: any[];
        sma50Series: any[];
      };
      const series = dataModel.series;

      expect(series.some((s: { name: string }) => s.name === '50 SMA')).toBe(
        true,
      );
      expect(dataModel.sma50Series).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      polygonService.getAggregates.mockReturnValue(of(null));

      const result = await tool.func({ ticker: 'INVALID' });
      const parsed = JSON.parse(String(result)) as {
        status: string;
        message: string;
      };

      expect(parsed.status).toBe('error');
      expect(parsed.message).toContain('No data available');
    });
  });
});

function generateMockOHLCVData(count: number): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  const startDate = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() - i);
    bars.push({
      timestamp: date,
      open: 150 + Math.random() * 10,
      high: 160 + Math.random() * 10,
      low: 140 + Math.random() * 10,
      close: 155 + Math.random() * 10,
      volume: 1000000,
    });
  }
  return bars;
}
