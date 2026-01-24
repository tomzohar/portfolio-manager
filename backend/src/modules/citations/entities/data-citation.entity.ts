import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ReasoningTrace } from '../../agents/entities/reasoning-trace.entity';
import { User } from '../../users/entities/user.entity';
import { CitationSourceType } from '../types/citation-source-type.enum';

/**
 * DataCitation Entity
 *
 * Links reasoning traces to their external data sources, enabling transparency
 * about which data points were used to generate specific claims.
 *
 * Features:
 * - Links to reasoning traces (optional - citations can exist independently)
 * - Links to threads and users (required for security and filtering)
 * - Stores source metadata (type, identifier, full data point)
 * - Supports inline citations with text and position
 * - Cascade delete when parent trace or user is deleted
 *
 * Use Cases:
 * - "Show me the data sources for this analysis"
 * - "Which FRED series were used in this inflation analysis?"
 * - "Verify the stock prices cited in this recommendation"
 *
 * This entity supports US-002: Data Source Citation System
 * from the Digital CIO Chat Interface feature.
 */
@Entity('data_citations')
export class DataCitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reasoning_trace_id', type: 'uuid', nullable: true })
  @Index()
  reasoningTraceId: string | null;

  @ManyToOne(() => ReasoningTrace, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'reasoning_trace_id' })
  reasoningTrace?: ReasoningTrace;

  @Column({ name: 'thread_id', type: 'varchar', length: 255 })
  @Index()
  threadId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'source_type', type: 'varchar', length: 50 })
  @Index('IDX_data_citations_source', ['sourceType', 'sourceIdentifier'])
  sourceType: CitationSourceType;

  @Column({ name: 'source_identifier', type: 'varchar', length: 255 })
  sourceIdentifier: string;

  @Column({ name: 'data_point', type: 'jsonb' })
  dataPoint: Record<string, any>;

  @Column({
    name: 'citation_text',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  citationText: string | null;

  @Column({ name: 'position_in_text', type: 'integer', nullable: true })
  positionInText: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
