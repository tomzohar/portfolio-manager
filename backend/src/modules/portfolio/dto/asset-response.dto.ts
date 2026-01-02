import { ApiProperty } from '@nestjs/swagger';
import { Asset } from '../entities/asset.entity';

/**
 * Enriched asset response DTO that includes current market data
 */
export class EnrichedAssetDto {
  @ApiProperty({ description: 'Asset ID' })
  id: string;

  @ApiProperty({ description: 'Ticker symbol' })
  ticker: string;

  @ApiProperty({ description: 'Quantity of shares', type: 'number' })
  quantity: number;

  @ApiProperty({ description: 'Average purchase price', type: 'number' })
  avgPrice: number;

  @ApiProperty({
    description: 'Current market price',
    type: 'number',
    required: false,
    nullable: true,
  })
  currentPrice?: number;

  @ApiProperty({
    description: "Today's price change in dollars",
    type: 'number',
    required: false,
    nullable: true,
  })
  todaysChange?: number;

  @ApiProperty({
    description: "Today's price change in percentage",
    type: 'number',
    required: false,
    nullable: true,
  })
  todaysChangePerc?: number;

  @ApiProperty({
    description: 'Last updated timestamp (Unix milliseconds)',
    type: 'number',
    required: false,
    nullable: true,
  })
  lastUpdated?: number;

  @ApiProperty({
    description: 'Total market value (currentPrice * quantity)',
    type: 'number',
    required: false,
    nullable: true,
  })
  marketValue?: number;

  @ApiProperty({
    description:
      'Profit/Loss in dollars ((currentPrice - avgPrice) * quantity)',
    type: 'number',
    required: false,
    nullable: true,
  })
  pl?: number;

  @ApiProperty({
    description:
      'Profit/Loss percentage ((currentPrice - avgPrice) / avgPrice)',
    type: 'number',
    required: false,
    nullable: true,
  })
  plPercent?: number;

  @ApiProperty({ description: 'Asset creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Asset last update date' })
  updatedAt: Date;

  constructor(
    asset: Asset,
    marketData?: {
      currentPrice?: number;
      todaysChange?: number;
      todaysChangePerc?: number;
      lastUpdated?: number;
    },
  ) {
    this.id = asset.id;
    this.ticker = asset.ticker;
    // Ensure numeric types are properly converted from Decimal
    this.quantity = Number(asset.quantity);
    this.avgPrice = Number(asset.avgPrice);
    this.createdAt = asset.createdAt;
    this.updatedAt = asset.updatedAt;

    if (marketData) {
      this.currentPrice = marketData.currentPrice;
      this.todaysChange = marketData.todaysChange;
      if (marketData.todaysChangePerc !== undefined) {
        this.todaysChangePerc =
          Number(marketData.todaysChangePerc.toFixed(2)) / 100;
      }
      this.lastUpdated = marketData.lastUpdated;
    }

    // Calculate derived metrics based on currentPrice availability
    if (
      this.currentPrice !== undefined &&
      this.currentPrice !== null &&
      this.avgPrice !== undefined &&
      this.avgPrice !== null
    ) {
      // Market Value: currentPrice * quantity
      this.marketValue = this.currentPrice * this.quantity;

      // Profit/Loss in dollars: (currentPrice - avgPrice) * quantity
      this.pl = (this.currentPrice - this.avgPrice) * this.quantity;

      // Profit/Loss percentage: (currentPrice - avgPrice) / avgPrice
      // Avoid division by zero
      if (this.avgPrice !== 0) {
        this.plPercent = (this.currentPrice - this.avgPrice) / this.avgPrice;
      }
    } else {
      // Fallback: When current price is unavailable, use cost basis
      // This ensures consistency with the portfolio summary calculation
      if (this.avgPrice !== undefined && this.avgPrice !== null) {
        this.marketValue = this.avgPrice * this.quantity;
        // P/L is 0 when using cost basis (no gain/loss)
        this.pl = 0;
        this.plPercent = 0;
      }
    }
  }
}
