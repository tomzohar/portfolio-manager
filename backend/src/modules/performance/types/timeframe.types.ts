/**
 * Timeframe enum for performance calculations
 * Represents different time periods for portfolio analysis
 */
export enum Timeframe {
  ONE_MONTH = '1M',
  THREE_MONTHS = '3M',
  SIX_MONTHS = '6M',
  ONE_YEAR = '1Y',
  YEAR_TO_DATE = 'YTD',
  ALL_TIME = 'ALL_TIME',
}

/**
 * Type guard for runtime validation of timeframe values
 * @param value - String value to validate
 * @returns True if value is a valid Timeframe
 */
export function isValidTimeframe(value: string): value is Timeframe {
  return Object.values(Timeframe).includes(value as Timeframe);
}
