import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PolygonApiService } from './services/polygon-api.service';
import { TickerResultDto } from './dto/ticker-result.dto';

/**
 * AssetsService
 * Business logic layer for asset/ticker operations
 */
@Injectable()
export class AssetsService {
  constructor(private readonly polygonApiService: PolygonApiService) {}

  /**
   * Search for stock tickers using the Polygon API
   * @param searchTerm - The search query (ticker symbol or company name)
   * @returns Observable of ticker results
   */
  searchTickers(searchTerm: string): Observable<TickerResultDto[]> {
    return this.polygonApiService.searchTickers(searchTerm);
  }
}
