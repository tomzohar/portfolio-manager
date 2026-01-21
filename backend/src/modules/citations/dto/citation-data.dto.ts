import { CitationSourceType } from '../types/citation-source-type.enum';

/**
 * CitationDataDto
 *
 * DTO for detailed citation data retrieval.
 * Returns the full citation with complete dataPoint and metadata.
 */
export class CitationDataDto {
  id: string;
  sourceType: CitationSourceType;
  sourceIdentifier: string;
  dataPoint: Record<string, any>;
  citationText: string | null;
  metadata: {
    retrievedAt: Date;
    apiVersion?: string;
  };
}
