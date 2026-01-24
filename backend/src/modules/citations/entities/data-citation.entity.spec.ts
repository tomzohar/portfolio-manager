import { DataCitation } from './data-citation.entity';
import { CitationSourceType } from '../types/citation-source-type.enum';

describe('DataCitation Entity', () => {
  it('should be defined', () => {
    const citation = new DataCitation();
    expect(citation).toBeDefined();
  });

  it('should have all required properties', () => {
    const citation = new DataCitation();

    // Required fields (should be assignable)
    expect(() => {
      citation.id = 'citation-123';
      citation.threadId = 'thread-456';
      citation.userId = 'user-789';
      citation.sourceType = CitationSourceType.FRED;
      citation.sourceIdentifier = 'CPIAUCSL';
      citation.dataPoint = { value: 3.2, date: '2024-01-01' };
      citation.createdAt = new Date();
    }).not.toThrow();

    // Nullable fields
    expect(() => {
      citation.reasoningTraceId = null;
      citation.citationText = null;
      citation.positionInText = null;
    }).not.toThrow();
  });

  it('should support all CitationSourceType enum values', () => {
    const citation = new DataCitation();

    // Test FRED
    citation.sourceType = CitationSourceType.FRED;
    expect(citation.sourceType).toBe('FRED');

    // Test POLYGON
    citation.sourceType = CitationSourceType.POLYGON;
    expect(citation.sourceType).toBe('Polygon');

    // Test NEWS_API
    citation.sourceType = CitationSourceType.NEWS_API;
    expect(citation.sourceType).toBe('NewsAPI');

    // Test FMP
    citation.sourceType = CitationSourceType.FMP;
    expect(citation.sourceType).toBe('FMP');
  });

  it('should accept JSONB data for dataPoint', () => {
    const citation = new DataCitation();

    // Simple data
    citation.dataPoint = { value: 3.2 };
    expect(citation.dataPoint).toEqual({ value: 3.2 });

    // Complex nested data
    citation.dataPoint = {
      series: 'CPIAUCSL',
      observations: [
        { date: '2024-01-01', value: 3.2 },
        { date: '2024-02-01', value: 3.1 },
      ],
      metadata: {
        frequency: 'Monthly',
        units: 'Percent Change',
      },
    };
    expect(citation.dataPoint).toHaveProperty('observations');
    expect(citation.dataPoint.observations).toHaveLength(2);
  });

  it('should handle nullable fields correctly', () => {
    const citation = new DataCitation();

    // reasoningTraceId can be null (citations can exist without traces)
    citation.reasoningTraceId = null;
    expect(citation.reasoningTraceId).toBeNull();

    citation.reasoningTraceId = 'trace-123';
    expect(citation.reasoningTraceId).toBe('trace-123');

    // citationText can be null
    citation.citationText = null;
    expect(citation.citationText).toBeNull();

    citation.citationText = 'Source: FRED CPIAUCSL (3.2%)';
    expect(citation.citationText).toBe('Source: FRED CPIAUCSL (3.2%)');

    // positionInText can be null
    citation.positionInText = null;
    expect(citation.positionInText).toBeNull();

    citation.positionInText = 42;
    expect(citation.positionInText).toBe(42);
  });

  it('should support typical FRED citation data', () => {
    const citation = new DataCitation();
    citation.sourceType = CitationSourceType.FRED;
    citation.sourceIdentifier = 'CPIAUCSL';
    citation.dataPoint = {
      series_id: 'CPIAUCSL',
      date: '2024-01-01',
      value: 3.2,
      title: 'Consumer Price Index for All Urban Consumers',
      units: 'Percent Change from Year Ago',
    };
    citation.citationText = 'Inflation was 3.2% (FRED: CPIAUCSL)';
    citation.positionInText = 15;

    expect(citation.sourceType).toBe(CitationSourceType.FRED);
    expect(citation.sourceIdentifier).toBe('CPIAUCSL');
    expect(citation.dataPoint).toHaveProperty('value', 3.2);
    expect(citation.citationText).toContain('3.2%');
  });

  it('should support typical Polygon stock price citation', () => {
    const citation = new DataCitation();
    citation.sourceType = CitationSourceType.POLYGON;
    citation.sourceIdentifier = 'AAPL';
    citation.dataPoint = {
      ticker: 'AAPL',
      date: '2024-01-15',
      close: 150.25,
      volume: 50000000,
      change_percent: 2.5,
    };
    citation.citationText = 'AAPL closed at $150.25';
    citation.positionInText = 0;

    expect(citation.sourceType).toBe(CitationSourceType.POLYGON);
    expect(citation.sourceIdentifier).toBe('AAPL');
    expect(citation.dataPoint).toHaveProperty('close', 150.25);
  });

  it('should support typical NewsAPI citation', () => {
    const citation = new DataCitation();
    citation.sourceType = CitationSourceType.NEWS_API;
    citation.sourceIdentifier = 'article-12345';
    citation.dataPoint = {
      title: 'Tech stocks rally on earnings beat',
      source: 'Reuters',
      publishedAt: '2024-01-15T10:00:00Z',
      sentiment: 'positive',
      relevance_score: 0.95,
    };
    citation.citationText = 'Reuters reported positive tech sentiment';
    citation.positionInText = 100;

    expect(citation.sourceType).toBe(CitationSourceType.NEWS_API);
    expect(citation.dataPoint).toHaveProperty('sentiment', 'positive');
  });

  it('should support typical FMP fundamental data citation', () => {
    const citation = new DataCitation();
    citation.sourceType = CitationSourceType.FMP;
    citation.sourceIdentifier = 'AAPL';
    citation.dataPoint = {
      symbol: 'AAPL',
      pe_ratio: 28.5,
      market_cap: 2800000000000,
      revenue_growth: 0.11,
      profit_margin: 0.25,
    };
    citation.citationText = 'AAPL P/E ratio is 28.5 (FMP)';
    citation.positionInText = 50;

    expect(citation.sourceType).toBe(CitationSourceType.FMP);
    expect(citation.dataPoint).toHaveProperty('pe_ratio', 28.5);
  });

  describe('CitationSourceType enum', () => {
    it('should have all required source types', () => {
      expect(CitationSourceType.FRED).toBe('FRED');
      expect(CitationSourceType.POLYGON).toBe('Polygon');
      expect(CitationSourceType.NEWS_API).toBe('NewsAPI');
      expect(CitationSourceType.FMP).toBe('FMP');
    });

    it('should have exactly 4 source types', () => {
      const sourceTypes = Object.values(CitationSourceType);
      expect(sourceTypes).toHaveLength(4);
    });
  });

  describe('Entity relationships', () => {
    it('should have optional relation to ReasoningTrace', () => {
      const citation = new DataCitation();

      // Should be able to set to null
      citation.reasoningTraceId = null;
      expect(citation.reasoningTraceId).toBeNull();

      // Should be able to set to a UUID
      citation.reasoningTraceId = 'trace-uuid-123';
      expect(citation.reasoningTraceId).toBe('trace-uuid-123');
    });

    it('should have required relation to User', () => {
      const citation = new DataCitation();

      // userId is required (not nullable in entity)
      citation.userId = 'user-uuid-456';
      expect(citation.userId).toBe('user-uuid-456');
    });
  });

  describe('Field constraints', () => {
    it('should respect citationText length constraint (500 chars)', () => {
      const citation = new DataCitation();
      const longText = 'a'.repeat(500);

      citation.citationText = longText;
      expect(citation.citationText).toHaveLength(500);
    });

    it('should handle source_identifier of various lengths', () => {
      const citation = new DataCitation();

      // Short identifier (FRED series)
      citation.sourceIdentifier = 'CPI';
      expect(citation.sourceIdentifier).toBe('CPI');

      // Medium identifier
      citation.sourceIdentifier = 'CPIAUCSL';
      expect(citation.sourceIdentifier).toBe('CPIAUCSL');

      // Long identifier (article ID, URL, etc.)
      const longId = 'article-' + 'x'.repeat(240);
      citation.sourceIdentifier = longId;
      expect(citation.sourceIdentifier).toHaveLength(248);
    });

    it('should handle position_in_text as integer', () => {
      const citation = new DataCitation();

      citation.positionInText = 0; // Start of text
      expect(citation.positionInText).toBe(0);

      citation.positionInText = 12345; // Middle of long text
      expect(citation.positionInText).toBe(12345);
    });
  });
});
