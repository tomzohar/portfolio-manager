import { ApiProperty } from '@nestjs/swagger';

export class TickerResultDto {
  @ApiProperty({ description: 'Ticker symbol', example: 'AAPL' })
  ticker: string;

  @ApiProperty({ description: 'Company name', example: 'Apple Inc.' })
  name: string;

  @ApiProperty({ description: 'Market type', example: 'stocks' })
  market: string;

  @ApiProperty({ description: 'Security type', example: 'CS' })
  type: string;

  constructor(data: {
    ticker: string;
    name: string;
    market: string;
    type: string;
  }) {
    this.ticker = data.ticker;
    this.name = data.name;
    this.market = data.market;
    this.type = data.type;
  }
}
