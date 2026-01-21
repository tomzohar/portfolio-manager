import { Controller, Logger } from '@nestjs/common';
import { CitationService } from '../services/citation.service';

/**
 * CitationsController
 *
 * REST endpoints for citation retrieval.
 * Will be implemented in US-002-BE-T5.
 */
@Controller('citations')
export class CitationsController {
  private readonly logger = new Logger(CitationsController.name);

  constructor(private readonly citationService: CitationService) {}

  // Endpoints will be implemented in US-002-BE-T5
}
