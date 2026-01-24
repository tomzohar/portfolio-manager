/**
 * Number Matcher Utility
 *
 * Utilities for extracting and matching numbers in citation extraction.
 * Handles special formats (1.5M, 23%, $45.67) and tolerance-based matching.
 */

/**
 * Configuration for number matching
 */
export const NUMBER_MATCHING_CONFIG = {
  /** Tolerance for fuzzy number matching (5% = 0.05) */
  MATCH_TOLERANCE: 0.05,

  /** Regular expression for extracting numbers from text */
  NUMBER_REGEX: /\b\d+(\.\d+)?([KMB]|%)?/g,

  /** Maximum size of dataPoint in bytes (1MB) */
  MAX_DATA_POINT_SIZE: 1048576,
} as const;

/**
 * Normalize number formats to standard numeric values
 * Examples:
 * - "1.5M" → 1500000
 * - "23%" → 23
 * - "45.67" → 45.67
 * - "100K" → 100000
 *
 * @param numberStr - String representation of a number
 * @returns Normalized numeric value
 */
export function normalizeNumber(numberStr: string): number {
  let value = numberStr.replace(/[,%$]/g, ''); // Remove commas, %, $

  // Handle K, M, B suffixes
  const suffix = value.match(/[KMB]$/i);
  if (suffix) {
    value = value.slice(0, -1); // Remove suffix
    const numericValue = parseFloat(value);

    switch (suffix[0].toUpperCase()) {
      case 'K':
        return numericValue * 1000;
      case 'M':
        return numericValue * 1000000;
      case 'B':
        return numericValue * 1000000000;
    }
  }

  return parseFloat(value);
}

/**
 * Check if two numbers match within tolerance
 * @param num1 - First number
 * @param num2 - Second number
 * @param tolerance - Tolerance (default: 5% = 0.05)
 * @returns true if numbers match within tolerance
 */
export function numbersMatchWithTolerance(
  num1: number,
  num2: number,
  tolerance: number = NUMBER_MATCHING_CONFIG.MATCH_TOLERANCE,
): boolean {
  if (num1 === 0 && num2 === 0) return true;
  if (num1 === 0 || num2 === 0) return false;

  const diff = Math.abs(num1 - num2);
  const avg = (Math.abs(num1) + Math.abs(num2)) / 2;
  const percentDiff = diff / avg;

  return percentDiff <= tolerance;
}

/**
 * Extract all numbers from text
 * @param text - Text to extract numbers from
 * @returns Array of objects with { value: number, original: string, position: number }
 */
export function extractNumbers(
  text: string,
): Array<{ value: number; original: string; position: number }> {
  const matches: Array<{ value: number; original: string; position: number }> =
    [];
  const regex = new RegExp(NUMBER_MATCHING_CONFIG.NUMBER_REGEX);

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const original: string = match[0];
    const position: number = match.index;
    const value = normalizeNumber(original);

    matches.push({
      value,
      original,
      position,
    });
  }

  return matches;
}

/**
 * Estimate size of JSON object in bytes
 * @param obj - Object to measure
 * @returns Estimated size in bytes
 */
export function estimateJsonSize(obj: any): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

/**
 * Truncate large data objects to summary
 * @param data - Data object to potentially truncate
 * @param maxSize - Maximum size in bytes
 * @returns Original data if small enough, summary if too large
 */
export function truncateLargeData(
  data: Record<string, unknown>,
  maxSize: number = NUMBER_MATCHING_CONFIG.MAX_DATA_POINT_SIZE,
): Record<string, unknown> {
  const size = estimateJsonSize(data);

  if (size <= maxSize) {
    return data;
  }

  // Create summary object
  return {
    _truncated: true,
    _originalSize: size,
    _summary: 'Data too large to store inline',
    ...Object.fromEntries(
      Object.entries(data)
        .slice(0, 5)
        .map(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            return [key, '[Object]'];
          }
          return [key, String(value).slice(0, 100)];
        }),
    ),
  };
}
