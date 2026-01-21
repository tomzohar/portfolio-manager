import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataCitation } from './entities/data-citation.entity';
import { ReasoningTrace } from '../agents/entities/reasoning-trace.entity';
import { CitationService } from './services/citation.service';
import { CitationsController } from './controllers/citations.controller';
import { AgentsModule } from '../agents/agents.module';

/**
 * Citations Module
 *
 * Manages data source citations for reasoning traces.
 * Enables transparency by tracking which external data (FRED, Polygon, NewsAPI, etc.)
 * was used to generate specific claims in the agent's reasoning.
 *
 * Features:
 * - Extract citations from tool results and final output
 * - Link citations to reasoning traces
 * - Retrieve citations by thread or citation ID
 * - Validate citation ownership (security)
 *
 * This module supports US-002: Data Source Citation System
 * from the Digital CIO Chat Interface feature.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DataCitation, ReasoningTrace]),
    forwardRef(() => AgentsModule), // For TracingService
  ],
  controllers: [CitationsController],
  providers: [CitationService],
  exports: [CitationService],
})
export class CitationsModule {}
