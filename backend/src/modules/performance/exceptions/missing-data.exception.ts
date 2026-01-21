import { BadRequestException } from '@nestjs/common';

/**
 * Exception thrown when required price data is missing
 * Used when historical or current price data cannot be fetched from Polygon API
 */
export class MissingDataException extends BadRequestException {
  constructor(ticker: string, reason: string) {
    super(`Missing price data for ${ticker}: ${reason}`);
  }
}
