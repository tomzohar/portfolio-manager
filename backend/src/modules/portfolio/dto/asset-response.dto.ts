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
    this.quantity = asset.quantity;
    this.avgPrice = asset.avgPrice;
    this.createdAt = asset.createdAt;
    this.updatedAt = asset.updatedAt;

    if (marketData) {
      this.currentPrice = marketData.currentPrice;
      this.todaysChange = marketData.todaysChange;
      this.todaysChangePerc = marketData.todaysChangePerc;
      this.lastUpdated = marketData.lastUpdated;
    }
  }
}
