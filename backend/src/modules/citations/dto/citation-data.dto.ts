import { ApiProperty } from '@nestjs/swagger';
import { CitationSourceType } from '../types/citation-source-type.enum';

/**
 * CitationDataDto
 *
 * DTO for detailed citation data retrieval.
 * Returns the full citation with complete dataPoint and metadata.
 */
export class CitationDataDto {
  @ApiProperty({
    description: 'Citation unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Source type (FRED, Polygon, NewsAPI, FMP)',
    enum: CitationSourceType,
    example: CitationSourceType.FRED,
  })
  sourceType: CitationSourceType;

  @ApiProperty({
    description: 'Source identifier (series ID, ticker, article ID)',
    example: 'CPIAUCSL',
  })
  sourceIdentifier: string;

  @ApiProperty({
    description: 'Full data point from external source',
    example: {
      series_id: 'CPIAUCSL',
      value: 3.2,
      date: '2024-01-01',
      units: 'Percent Change',
    },
  })
  dataPoint: Record<string, any>;

  @ApiProperty({
    description: 'Formatted citation text for display',
    example: 'Source: FRED CPIAUCSL (3.2%)',
    nullable: true,
  })
  citationText: string | null;

  @ApiProperty({
    description: 'Citation metadata',
    example: {
      retrievedAt: '2024-01-15T10:30:00Z',
      apiVersion: 'v1',
    },
  })
  metadata: {
    retrievedAt: Date;
    apiVersion?: string;
  };
}
