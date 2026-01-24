import {
  normalizeNumber,
  numbersMatchWithTolerance,
  extractNumbers,
  estimateJsonSize,
  truncateLargeData,
} from './number-matcher.util';

describe('Number Matcher Utility', () => {
  describe('normalizeNumber', () => {
    it('should parse plain numbers', () => {
      expect(normalizeNumber('42')).toBe(42);
      expect(normalizeNumber('3.14')).toBe(3.14);
      expect(normalizeNumber('0.5')).toBe(0.5);
    });

    it('should handle K suffix (thousands)', () => {
      expect(normalizeNumber('1K')).toBe(1000);
      expect(normalizeNumber('1.5K')).toBe(1500);
      expect(normalizeNumber('100K')).toBe(100000);
    });

    it('should handle M suffix (millions)', () => {
      expect(normalizeNumber('1M')).toBe(1000000);
      expect(normalizeNumber('1.5M')).toBe(1500000);
      expect(normalizeNumber('2.8M')).toBe(2800000);
    });

    it('should handle B suffix (billions)', () => {
      expect(normalizeNumber('1B')).toBe(1000000000);
      expect(normalizeNumber('2.5B')).toBe(2500000000);
    });

    it('should handle percentage signs', () => {
      expect(normalizeNumber('23%')).toBe(23);
      expect(normalizeNumber('3.2%')).toBe(3.2);
      expect(normalizeNumber('0.5%')).toBe(0.5);
    });

    it('should handle dollar signs', () => {
      expect(normalizeNumber('$45.67')).toBe(45.67);
      expect(normalizeNumber('$1000')).toBe(1000);
    });

    it('should handle commas', () => {
      expect(normalizeNumber('1,000')).toBe(1000);
      expect(normalizeNumber('1,234,567')).toBe(1234567);
    });

    it('should handle combined formats', () => {
      expect(normalizeNumber('$1.5M')).toBe(1500000);
      expect(normalizeNumber('$45.67')).toBe(45.67);
    });
  });

  describe('numbersMatchWithTolerance', () => {
    it('should match exact numbers', () => {
      expect(numbersMatchWithTolerance(100, 100)).toBe(true);
      expect(numbersMatchWithTolerance(3.2, 3.2)).toBe(true);
    });

    it('should match numbers within 5% tolerance', () => {
      expect(numbersMatchWithTolerance(100, 103)).toBe(true); // 3% diff
      expect(numbersMatchWithTolerance(100, 97)).toBe(true); // 3% diff
      expect(numbersMatchWithTolerance(3.2, 3.3)).toBe(true); // ~3% diff
    });

    it('should not match numbers outside 5% tolerance', () => {
      expect(numbersMatchWithTolerance(100, 110)).toBe(false); // 10% diff
      expect(numbersMatchWithTolerance(100, 90)).toBe(false); // 10% diff
      expect(numbersMatchWithTolerance(3.2, 4.0)).toBe(false); // 25% diff
    });

    it('should handle zero values correctly', () => {
      expect(numbersMatchWithTolerance(0, 0)).toBe(true);
      expect(numbersMatchWithTolerance(0, 1)).toBe(false);
      expect(numbersMatchWithTolerance(1, 0)).toBe(false);
    });

    it('should handle negative numbers', () => {
      expect(numbersMatchWithTolerance(-100, -103)).toBe(true);
      expect(numbersMatchWithTolerance(-100, -110)).toBe(false);
    });

    it('should support custom tolerance', () => {
      expect(numbersMatchWithTolerance(100, 110, 0.1)).toBe(true); // 10% tolerance
      expect(numbersMatchWithTolerance(100, 110, 0.05)).toBe(false); // 5% tolerance
    });
  });

  describe('extractNumbers', () => {
    it('should extract plain numbers from text', () => {
      const text = 'The inflation rate is 3.2 percent';
      const numbers = extractNumbers(text);

      expect(numbers).toHaveLength(1);
      expect(numbers[0].value).toBe(3.2);
      expect(numbers[0].original).toBe('3.2');
      expect(numbers[0].position).toBe(22);
    });

    it('should extract multiple numbers', () => {
      const text = 'Portfolio gained 5% with alpha of -0.06';
      const numbers = extractNumbers(text);

      expect(numbers).toHaveLength(2);
      expect(numbers[0].value).toBe(5);
      expect(numbers[0].original).toBe('5%');
      expect(numbers[1].value).toBe(0.06);
      expect(numbers[1].original).toBe('0.06');
    });

    it('should extract numbers with K/M/B suffixes', () => {
      const text = 'Market cap is 2.8M with revenue of 1.5B';
      const numbers = extractNumbers(text);

      expect(numbers).toHaveLength(2);
      expect(numbers[0].value).toBe(2800000);
      expect(numbers[0].original).toBe('2.8M');
      expect(numbers[1].value).toBe(1500000000);
      expect(numbers[1].original).toBe('1.5B');
    });

    it('should handle empty text', () => {
      const numbers = extractNumbers('');
      expect(numbers).toHaveLength(0);
    });

    it('should handle text with no numbers', () => {
      const numbers = extractNumbers('No numbers here');
      expect(numbers).toHaveLength(0);
    });

    it('should preserve position information', () => {
      const text = 'First 100 then 200 finally 300';
      const numbers = extractNumbers(text);

      expect(numbers).toHaveLength(3);
      expect(numbers[0].position).toBe(6); // Position of "100"
      expect(numbers[1].position).toBe(15); // Position of "200"
      expect(numbers[2].position).toBe(27); // Position of "300"
    });
  });

  describe('estimateJsonSize', () => {
    it('should estimate size of simple objects', () => {
      const obj = { value: 42 };
      const size = estimateJsonSize(obj);

      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThan(100);
    });

    it('should estimate larger sizes for complex objects', () => {
      const simpleObj = { value: 42 };
      const complexObj = {
        series: 'CPIAUCSL',
        data: Array.from({ length: 100 }, (_item, index) => ({
          date: `2024-01-${index}`,
          value: Math.random(),
        })),
      };

      const simpleSize = estimateJsonSize(simpleObj);
      const complexSize = estimateJsonSize(complexObj);

      expect(complexSize).toBeGreaterThan(simpleSize);
    });
  });

  describe('truncateLargeData', () => {
    it('should return original data if size is below threshold', () => {
      const data = { value: 42, name: 'test' };
      const result = truncateLargeData(data);

      expect(result).toEqual(data);
      expect(result._truncated).toBeUndefined();
    });

    it('should truncate large data objects', () => {
      // Create large object (>1MB)
      const largeData = {
        series: 'CPIAUCSL',
        observations: Array.from({ length: 50000 }, () => ({
          date: `2024-01-01`,
          value: Math.random(),
          metadata: 'some metadata that makes this larger',
        })),
      };

      const result = truncateLargeData(largeData, 1000); // Use small threshold for testing

      expect(result._truncated).toBe(true);

      expect(result._originalSize).toBeGreaterThan(1000);

      expect(result._summary).toBe('Data too large to store inline');
    });

    it('should preserve first 5 keys in summary', () => {
      const largeData = {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
        key4: 'value4',
        key5: 'value5',
        key6: 'value6',
        key7: 'value7',
      };

      const result = truncateLargeData(largeData, 10); // Small threshold

      // Should have truncation metadata + first 5 keys

      expect(result._truncated).toBe(true);

      expect(result.key1).toBeDefined();

      expect(result.key5).toBeDefined();
    });
  });
});
