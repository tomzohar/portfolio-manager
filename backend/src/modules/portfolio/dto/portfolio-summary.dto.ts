import { ApiProperty } from '@nestjs/swagger';

// Position Summary DTO (per-ticker aggregation)
export class PositionSummaryDto {
  @ApiProperty({
    description: 'Ticker symbol',
  })
  ticker: string;

  @ApiProperty({
    description: 'Net quantity (buys - sells)',
    type: 'number',
  })
  quantity: number;

  @ApiProperty({
    description: 'Weighted average cost basis per share',
    type: 'number',
  })
  avgCostBasis: number;

  @ApiProperty({
    description: 'Current market price',
    type: 'number',
    required: false,
    nullable: true,
  })
  currentPrice?: number;

  @ApiProperty({
    description: 'Current market value (quantity * currentPrice)',
    type: 'number',
    required: false,
    nullable: true,
  })
  marketValue?: number;

  @ApiProperty({
    description:
      'Unrealized profit/loss ((currentPrice - avgCostBasis) * quantity)',
    type: 'number',
    required: false,
    nullable: true,
  })
  unrealizedPL?: number;

  @ApiProperty({
    description: 'Unrealized profit/loss percentage',
    type: 'number',
    required: false,
    nullable: true,
  })
  unrealizedPLPercent?: number;

  constructor(data: {
    ticker: string;
    quantity: number;
    avgCostBasis: number;
    currentPrice?: number;
  }) {
    this.ticker = data.ticker;
    this.quantity = data.quantity;
    this.avgCostBasis = data.avgCostBasis;

    if (data.currentPrice !== undefined && data.currentPrice !== null) {
      this.currentPrice = data.currentPrice;
      this.marketValue = data.currentPrice * data.quantity;
      this.unrealizedPL =
        (data.currentPrice - data.avgCostBasis) * data.quantity;

      // Calculate percentage, avoid division by zero
      if (data.avgCostBasis !== 0) {
        this.unrealizedPLPercent =
          (data.currentPrice - data.avgCostBasis) / data.avgCostBasis;
      }
    }
  }
}

// Portfolio Summary DTO (aggregated view)
export class PortfolioSummaryDto {
  @ApiProperty({
    description: 'Total current market value across all positions',
    type: 'number',
  })
  totalValue: number;

  @ApiProperty({
    description: 'Total cost basis (total amount invested)',
    type: 'number',
  })
  totalCostBasis: number;

  @ApiProperty({
    description: 'Total unrealized profit/loss',
    type: 'number',
  })
  unrealizedPL: number;

  @ApiProperty({
    description: 'Total unrealized profit/loss percentage',
    type: 'number',
  })
  unrealizedPLPercent: number;

  @ApiProperty({
    description: 'Array of positions by ticker',
    type: [PositionSummaryDto],
  })
  positions: PositionSummaryDto[];

  constructor(data: {
    totalValue: number;
    totalCostBasis: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
    positions: PositionSummaryDto[];
  }) {
    this.totalValue = data.totalValue;
    this.totalCostBasis = data.totalCostBasis;
    this.unrealizedPL = data.unrealizedPL;
    this.unrealizedPLPercent = data.unrealizedPLPercent;
    this.positions = data.positions;
  }
}
