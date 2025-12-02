import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AssetsService } from './assets.service';
import { SearchAssetsDto } from './dto/search-assets.dto';
import { TickerResultDto } from './dto/ticker-result.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * AssetsController
 * Handles ticker/asset search operations
 */
@ApiTags('assets')
@Controller('assets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  /**
   * Search for stock tickers
   * GET /assets/search?q=searchTerm
   */
  @Get('search')
  @ApiOperation({ summary: 'Search for stock tickers' })
  @ApiResponse({
    status: 200,
    description: 'List of matching tickers',
    type: [TickerResultDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid search query',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Polygon API failure',
  })
  search(@Query() query: SearchAssetsDto): Observable<TickerResultDto[]> {
    return this.assetsService.searchTickers(query.q);
  }
}
