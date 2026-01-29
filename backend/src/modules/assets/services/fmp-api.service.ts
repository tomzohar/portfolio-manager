import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Observable, map, catchError, of } from 'rxjs';

export interface FmpStock {
  symbol: string;
  companyName: string;
  price: number;
  beta: number;
  volume: number;
  marketCap: number;
  sector: string;
  industry: string;
  exchange: string;
  exchangeShortName: string;
  country: string;
  isEtf: boolean;
  isActivelyTrading: boolean;
  dividend: number;
  lastAnnualDividend: number;
}

export interface FmpProfile {
  symbol: string;
  price: number;
  beta: number;
  volAvg: number;
  mktCap: number;
  lastDiv: number;
  range: string;
  changes: number;
  companyName: string;
  currency: string;
  cik: string;
  isin: string;
  cusip: string;
  exchange: string;
  exchangeShortName: string;
  industry: string;
  website: string;
  description: string;
  ceo: string;
  sector: string;
}

export interface FmpRatios {
  symbol: string;
  date: string;
  period: string;
  priceToEarningsRatio: number;
  priceToBookRatio: number;
  priceToSalesRatio: number;
  priceToFreeCashFlowRatio: number;
  dividendYield: number;
  returnOnEquity: number;
  debtEquityRatio: number;
}

export interface FmpScreenerCriteria {
  sector?: string;
  industry?: string;
  marketCapMoreThan?: number;
  marketCapLowerThan?: number;
  priceMoreThan?: number;
  priceLowerThan?: number;
  volumeMoreThan?: number;
  volumeLowerThan?: number;
  betaMoreThan?: number;
  betaLowerThan?: number;
  dividendMoreThan?: number;
  dividendLowerThan?: number;
  isEtf?: boolean;
  isActivelyTrading?: boolean;
  limit?: number;
  exchange?: string;
  country?: string;
  apikey?: string; // Included for internal use when merging params
}

/**
 * Service for interacting with Financial Modeling Prep (FMP) API.
 * Uses 'stable' endpoints with query parameters to support all plan tiers.
 */
@Injectable()
export class FmpApiService {
  private readonly logger = new Logger(FmpApiService.name);
  private readonly stableUrl = 'https://financialmodelingprep.com/stable';
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('FMP_API_KEY') ?? '';

    if (!this.apiKey) {
      this.logger.warn('FMP_API_KEY not configured');
    }
  }

  /**
   * Screen stocks based on criteria.
   * Wraps GET /stable/company-screener
   */
  screenStocks(criteria: FmpScreenerCriteria): Observable<FmpStock[]> {
    this.logger.log(
      `Screening stocks with criteria: ${JSON.stringify(criteria)}`,
    );

    const params = {
      ...criteria,
      apikey: this.apiKey,
    };

    return this.httpService
      .get<FmpStock[]>(`${this.stableUrl}/company-screener`, { params })
      .pipe(
        map((response) => {
          const results = response.data;
          this.logger.log(`FMP Screener found ${results?.length || 0} stocks`);

          return Array.isArray(results) ? results : [];
        }),
        catchError((error: Error) => {
          this.logger.error(
            `FMP Screener error: ${error.message}`,
            error.stack,
          );
          return of([]);
        }),
      );
  }

  /**
   * Get company profile (price, beta, mkt cap, etc).
   * Wraps GET /stable/profile?symbol=...
   */
  getProfile(symbol: string): Observable<FmpProfile | null> {
    this.logger.log(`Fetching profile for ${symbol}`);

    const params = {
      symbol: symbol,
      apikey: this.apiKey,
    };

    return this.httpService
      .get<FmpProfile[]>(`${this.stableUrl}/profile`, { params })
      .pipe(
        map((response) => {
          if (response.data && response.data.length > 0) {
            return response.data[0];
          }
          return null;
        }),
        catchError((error: Error) => {
          this.logger.error(
            `FMP Profile error for ${symbol}: ${error.message}`,
          );
          return of(null);
        }),
      );
  }

  /**
   * Get key financial ratios (P/E, ROE, Debt/Equity).
   * Wraps GET /stable/ratios?symbol=...
   */
  getKeyRatios(symbol: string): Observable<FmpRatios | null> {
    this.logger.log(`Fetching ratios for ${symbol}`);

    const params = {
      symbol: symbol,
      limit: 1,
      apikey: this.apiKey,
    };

    return this.httpService
      .get<FmpRatios[]>(`${this.stableUrl}/ratios`, { params })
      .pipe(
        map((response) => {
          if (response.data && response.data.length > 0) {
            return response.data[0];
          }
          return null;
        }),
        catchError((error: Error) => {
          this.logger.error(`FMP Ratios error for ${symbol}: ${error.message}`);
          return of(null);
        }),
      );
  }
}
