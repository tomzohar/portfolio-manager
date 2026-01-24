import { ApiProperty } from '@nestjs/swagger';
import { CitationSourceType } from '../types/citation-source-type.enum';

/**
 * CitationResponseDto
 *
 * DTO for citation retrieval endpoints.
 * Returns essential citation information without full dataPoint.
 */
export class CitationResponseDto {
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
    description: 'Formatted citation text for display',
    example: 'Source: FRED CPIAUCSL (3.2%)',
    nullable: true,
  })
  citationText: string | null;

  @ApiProperty({
    description: 'Character position in output text',
    example: 42,
    nullable: true,
  })
  positionInText: number | null;

  @ApiProperty({
    description: 'Citation creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;
}
