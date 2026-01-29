import { DynamicStructuredTool } from '@langchain/core/tools';
import { createFundamentalAnalystTool } from './fundamental-analyst.tool';
import { PolygonApiService } from '../../assets/services/polygon-api.service';
import { of } from 'rxjs';
import {
  PolygonFinancialsResponse,
  PolygonSnapshotResponse,
} from '../../assets/types/polygon-api.types';
import { FundamentalAnalysisResult } from '../types/fundamental-analyst.types';

describe('FundamentalAnalystTool', () => {
  let polygonService: jest.Mocked<PolygonApiService>;
  let tool: DynamicStructuredTool;

  beforeEach(() => {
    polygonService = {
      getFinancials: jest.fn(),
      getTickerDetails: jest.fn(),
      getTickerSnapshot: jest.fn(),
    } as unknown as jest.Mocked<PolygonApiService>;

    tool = createFundamentalAnalystTool(polygonService);
  });

  it('should fetch and calculate metrics for a valid ticker', async () => {
    const mockFinancials = {
      results: [
        {
          company_name: 'Apple Inc.',
          fiscal_period: 'Q4',
          fiscal_year: '2023',
          financials: {
            income_statement: {
              revenues: { value: 100000000 },
              net_income_loss: { value: 20000000 },
              operating_income_loss: { value: 30000000 },
              gross_profit: { value: 45000000 },
            },
            balance_sheet: {
              assets: { value: 500000000 },
              equity: { value: 200000000 },
              liabilities: { value: 300000000 },
              current_assets: { value: 150000000 },
              current_liabilities: { value: 75000000 },
            },
            cash_flow_statement: {
              net_cash_flow_from_operating_activities: { value: 25000000 },
              payments_for_property_plant_and_equipment: { value: 5000000 },
            },
          },
        },
      ],
      status: 'OK',
      request_id: 'req1',
      count: 1,
    } as unknown as PolygonFinancialsResponse;

    const mockDetails = {
      name: 'Apple Inc.',
      locale: 'us',
      currency_name: 'usd',
    };

    const mockSnapshot = {
      ticker: {
        day: { c: 150 },
      },
    };

    polygonService.getFinancials.mockReturnValue(of(mockFinancials));
    polygonService.getTickerDetails.mockReturnValue(of(mockDetails));
    polygonService.getTickerSnapshot.mockReturnValue(
      of(mockSnapshot as any as PolygonSnapshotResponse),
    );

    const result = (await tool.invoke({
      ticker: 'AAPL',
      period: 'annual',
    })) as string;
    const parsedResult = JSON.parse(result) as FundamentalAnalysisResult;

    expect(parsedResult.ticker).toBe('AAPL');
    expect(parsedResult.company_name).toBe('Apple Inc.');
    expect(parsedResult.fiscal_period).toBe('Q4 2023');

    // Profitability
    expect(parsedResult.profitability.net_margin).toBeCloseTo(20, 1);
    expect(parsedResult.profitability.roe).toBeCloseTo(10, 1); // 20m / 200m * 100

    // Health
    expect(parsedResult.financial_health.current_ratio).toBe(2); // 150m / 75m
    expect(parsedResult.financial_health.debt_to_equity).toBeCloseTo(1.5, 1); // 300m / 200m

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(polygonService.getFinancials).toHaveBeenCalledWith(
      'AAPL',
      1,
      'annual',
    );
  });

  it('should handle missing financials gracefully', async () => {
    polygonService.getFinancials.mockReturnValue(
      of({
        results: [],
        count: 0,
        status: 'OK',
        request_id: 'req1',
      } as unknown as PolygonFinancialsResponse),
    );
    polygonService.getTickerDetails.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      of({ name: 'Invalid Ticker', locale: 'us', currency_name: 'usd' } as any),
    );

    const result = (await tool.invoke({ ticker: 'INVALID' })) as string;
    const parsedResult = JSON.parse(result) as FundamentalAnalysisResult;

    expect(parsedResult.error).toContain(
      'No fundamental data available for INVALID',
    );
  });

  it('should handle partial financial data by returning null for missing metrics', async () => {
    const mockPartialFinancials = {
      results: [
        {
          company_name: 'Partial Co',
          fiscal_period: 'Q1',
          fiscal_year: '2024',
          financials: {
            income_statement: {
              revenues: { value: 1000000 },
              // net_income_loss is missing
            },
            balance_sheet: {
              assets: { value: 5000000 },
            },
          },
        },
      ],
      status: 'OK',
      request_id: 'req_partial',
      count: 1,
    } as unknown as PolygonFinancialsResponse;

    polygonService.getFinancials.mockReturnValue(of(mockPartialFinancials));
    polygonService.getTickerDetails.mockReturnValue(
      of({ name: 'Partial Co' } as any as {
        name: string;
        locale: string;
        currency_name: string;
      }),
    );
    polygonService.getTickerSnapshot.mockReturnValue(of(null));

    const result = (await tool.invoke({ ticker: 'PARTIAL' })) as string;
    const parsedResult = JSON.parse(result) as FundamentalAnalysisResult;

    expect(parsedResult.profitability.net_margin).toBeNull();
    expect(parsedResult.profitability.gross_margin).toBeNull();
    expect(parsedResult.financial_health.current_ratio).toBeNull();
    expect(parsedResult.valuation.pe_ratio).toBeNull();
  });

  it('should return null for price-dependent metrics if snapshot fetch fails', async () => {
    const mockFinancials = {
      results: [
        {
          company_name: 'No Price Co',
          fiscal_period: 'FY',
          fiscal_year: '2023',
          financials: {
            income_statement: {
              revenues: { value: 1000000 },
              basic_earnings_per_share: { value: 5.0 },
            },
            balance_sheet: {
              equity: { value: 10000000 },
              basic_common_shares_outstanding: { value: 1000000 },
            },
          },
        },
      ],
      status: 'OK',
      request_id: 'req_no_price',
      count: 1,
    } as unknown as PolygonFinancialsResponse;

    polygonService.getFinancials.mockReturnValue(of(mockFinancials));
    polygonService.getTickerDetails.mockReturnValue(
      of({ name: 'No Price Co' } as any as {
        name: string;
        locale: string;
        currency_name: string;
      }),
    );
    polygonService.getTickerSnapshot.mockReturnValue(of(null));

    const result = (await tool.invoke({ ticker: 'NOPRICE' })) as string;
    const parsedResult = JSON.parse(result) as FundamentalAnalysisResult;

    expect(parsedResult.valuation.pe_ratio).toBeNull();
    expect(parsedResult.valuation.market_cap).toBeNull();
  });

  it('should fallback to previous day price if today price is 0', async () => {
    const mockSnapshot = {
      ticker: {
        day: { c: 0 },
        prevDay: { c: 150 },
      },
    };

    const mockFinancials = {
      results: [
        {
          company_name: 'Fallback Price Co',
          financials: {
            income_statement: {
              basic_earnings_per_share: { value: 10 },
            },
            balance_sheet: {
              basic_common_shares_outstanding: { value: 1000 },
            },
          },
        },
      ],
      status: 'OK',
      count: 1,
    } as unknown as PolygonFinancialsResponse;

    polygonService.getFinancials.mockReturnValue(of(mockFinancials));
    polygonService.getTickerDetails.mockReturnValue(
      of({ name: 'Fallback Price Co' } as any as {
        name: string;
        locale: string;
        currency_name: string;
      }),
    );
    polygonService.getTickerSnapshot.mockReturnValue(
      of(mockSnapshot as any as PolygonSnapshotResponse),
    );

    const result = (await tool.invoke({ ticker: 'FALLBACK' })) as string;
    const parsedResult = JSON.parse(result) as FundamentalAnalysisResult;

    // 150 (prevDay) / 10 (eps) = 15
    expect(parsedResult.valuation.pe_ratio).toBe(15);
  });

  it('should fallback to average shares if common shares outstanding is missing', async () => {
    const mockSnapshot = {
      ticker: { day: { c: 100 } },
    };

    const mockFinancials = {
      results: [
        {
          company_name: 'Fallback Shares Co',
          financials: {
            income_statement: {
              basic_average_shares: { value: 5000 },
            },
            balance_sheet: {
              // basic_common_shares_outstanding is missing
              equity: { value: 100000 },
            },
          },
        },
      ],
      status: 'OK',
      count: 1,
    } as unknown as PolygonFinancialsResponse;

    polygonService.getFinancials.mockReturnValue(of(mockFinancials));
    polygonService.getTickerDetails.mockReturnValue(
      of({ name: 'Fallback Shares Co' } as any as {
        name: string;
        locale: string;
        currency_name: string;
      }),
    );
    polygonService.getTickerSnapshot.mockReturnValue(
      of(mockSnapshot as any as PolygonSnapshotResponse),
    );

    const result = (await tool.invoke({ ticker: 'SHARES' })) as string;
    const parsedResult = JSON.parse(result) as FundamentalAnalysisResult;

    // 5000 (avg shares) * 100 (price) = 500,000
    expect(parsedResult.valuation.market_cap).toBe(500000);
  });
});
