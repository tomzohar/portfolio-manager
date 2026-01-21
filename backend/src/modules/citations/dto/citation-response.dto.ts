import { CitationSourceType } from '../types/citation-source-type.enum';

/**
 * CitationResponseDto
 *
 * DTO for citation retrieval endpoints.
 * Returns essential citation information without full dataPoint.
 */
export class CitationResponseDto {
  id: string;
  sourceType: CitationSourceType;
  sourceIdentifier: string;
  citationText: string | null;
  positionInText: number | null;
  createdAt: Date;
}
