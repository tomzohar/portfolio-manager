import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { FinnhubApiService } from '../../assets/services/finnhub-api.service';
import {
  createEarningsCalendarTool,
  EarningsCalendarResult,
} from './earnings-calendar.tool';
import {
  FinnhubEarningsCalendarResponse,
  FinnhubEarningsSurprise,
} from '../../assets/types/finnhub-api.types';

describe('EarningsCalendarTool', () => {
  let finnhubService: jest.Mocked<FinnhubApiService>;
  let tool: ReturnType<typeof createEarningsCalendarTool>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: FinnhubApiService,
          useValue: {
            getEarningsCalendar: jest.fn(),
            getEarningsSurprises: jest.fn(),
          },
        },
      ],
    }).compile();

    finnhubService = module.get(FinnhubApiService);
    tool = createEarningsCalendarTool(finnhubService);
  });

  it('should calculate risk levels correctly based on dates', async () => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 5);

    const farFuture = new Date();
    farFuture.setDate(today.getDate() + 15);

    const mockCalendar: FinnhubEarningsCalendarResponse = {
      earningsCalendar: [
        {
          date: tomorrow.toISOString().split('T')[0],
          symbol: 'AAPL',
          epsActual: null,
          epsEstimate: 2.5,
          hour: 'amc',
          quarter: 1,
          year: 2026,
          revenueActual: null,
          revenueEstimate: 1000000,
        },
        {
          date: nextWeek.toISOString().split('T')[0],
          symbol: 'MSFT',
          epsActual: null,
          epsEstimate: 3.0,
          hour: 'bmo',
          quarter: 1,
          year: 2026,
          revenueActual: null,
          revenueEstimate: 2000000,
        },
        {
          date: farFuture.toISOString().split('T')[0],
          symbol: 'GOOGL',
          epsActual: null,
          epsEstimate: 1.5,
          hour: 'amc',
          quarter: 1,
          year: 2026,
          revenueActual: null,
          revenueEstimate: 500000,
        },
      ],
    };

    finnhubService.getEarningsCalendar.mockReturnValue(of(mockCalendar));
    finnhubService.getEarningsSurprises.mockReturnValue(of([]));

    const result = await tool.func({ days_ahead: 30, days_past: 30 });
    const parsed = JSON.parse(String(result)) as EarningsCalendarResult;

    expect(parsed.upcoming_earnings[0].risk_level).toBe('High'); // Tomorrow
    expect(parsed.upcoming_earnings[1].risk_level).toBe('Medium'); // 5 days
    expect(parsed.upcoming_earnings[2].risk_level).toBe('Low'); // 15 days
  });

  it('should include surprises when a symbol is provided', async () => {
    const mockCalendar: FinnhubEarningsCalendarResponse = {
      earningsCalendar: [],
    };
    const mockSurprises: FinnhubEarningsSurprise[] = [
      {
        symbol: 'AAPL',
        actual: 1.5,
        estimate: 1.4,
        period: '2025-12-31',
        quarter: 4,
        surprise: 0.1,
        surprisePercent: 7.14,
        year: 2025,
      },
    ];

    finnhubService.getEarningsCalendar.mockReturnValue(of(mockCalendar));
    finnhubService.getEarningsSurprises.mockReturnValue(of(mockSurprises));

    const result = await tool.func({
      symbol: 'AAPL',
      days_ahead: 30,
      days_past: 30,
    });
    const parsed = JSON.parse(String(result)) as EarningsCalendarResult;

    expect(parsed.recent_earnings).toHaveLength(1);
    expect(parsed.recent_earnings[0].actual_eps).toBe(1.5);
    expect(parsed.recent_earnings[0].surprise).toBe(0.1);
  });

  it('should handle API errors gracefully', async () => {
    finnhubService.getEarningsCalendar.mockReturnValue(of(null));
    finnhubService.getEarningsSurprises.mockReturnValue(of([]));

    const result = await tool.func({
      symbol: 'AAPL',
      days_ahead: 30,
      days_past: 30,
    });
    const parsed = JSON.parse(String(result)) as EarningsCalendarResult;

    expect(parsed.upcoming_earnings).toEqual([]);
    expect(parsed.summary).toContain('No upcoming earnings found');
  });
});
