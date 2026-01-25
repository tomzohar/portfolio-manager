import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

/**
 * Migration: Enhance Reasoning Traces for US-001
 *
 * Adds enhanced tracing capabilities to the reasoning_traces table:
 * - status: Track execution status (pending, running, completed, failed, interrupted)
 * - tool_results: Store results from external tool calls (JSONB)
 * - duration_ms: Record node execution duration
 * - error: Store error messages for failed traces
 * - step_index: Track execution sequence order
 *
 * This migration supports US-001: Step-by-Step Reasoning Transparency
 * from the Digital CIO Chat Interface feature.
 */
export class EnhanceReasoningTraces1737468000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns safely
    if (!(await queryRunner.hasColumn('reasoning_traces', 'status'))) {
      await queryRunner.addColumn(
        'reasoning_traces',
        new TableColumn({
          name: 'status',
          type: 'varchar',
          length: '20',
          default: "'completed'",
          isNullable: true,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('reasoning_traces', 'tool_results'))) {
      await queryRunner.addColumn(
        'reasoning_traces',
        new TableColumn({
          name: 'tool_results',
          type: 'jsonb',
          default: "'[]'",
          isNullable: true,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('reasoning_traces', 'duration_ms'))) {
      await queryRunner.addColumn(
        'reasoning_traces',
        new TableColumn({
          name: 'duration_ms',
          type: 'integer',
          isNullable: true,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('reasoning_traces', 'error'))) {
      await queryRunner.addColumn(
        'reasoning_traces',
        new TableColumn({
          name: 'error',
          type: 'text',
          isNullable: true,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('reasoning_traces', 'step_index'))) {
      await queryRunner.addColumn(
        'reasoning_traces',
        new TableColumn({
          name: 'step_index',
          type: 'integer',
          isNullable: true,
        }),
      );
    }

    // Add constraint for status values safely
    // Easier to try/catch for constraints or check existence via query usually
    try {
      await queryRunner.query(`
        ALTER TABLE reasoning_traces 
        ADD CONSTRAINT chk_reasoning_traces_status 
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'interrupted'))
      `);
    } catch {
      // Ignore if constraint already exists
    }

    // Add composite index for (threadId, stepIndex) for efficient ordering
    // Check if index exists is a bit verbose with simple hasIndex, assume try/catch or ensure check
    // queryRunner.hasIndex might not be available in old typeorm versions? It usually is.
    // Let's use clean approach:

    // Note: TableIndex checks are complex because name might vary if auto-generated previously.
    // We specified names, so we can check.

    try {
      await queryRunner.createIndex(
        'reasoning_traces',
        new TableIndex({
          name: 'IDX_reasoning_traces_thread_step',
          columnNames: ['threadId', 'step_index'],
        }),
      );
    } catch {
      // Ignore if index already exists
    }

    try {
      await queryRunner.createIndex(
        'reasoning_traces',
        new TableIndex({
          name: 'IDX_reasoning_traces_status',
          columnNames: ['status'],
        }),
      );
    } catch {
      // Ignore if index already exists
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      'reasoning_traces',
      'IDX_reasoning_traces_status',
    );
    await queryRunner.dropIndex(
      'reasoning_traces',
      'IDX_reasoning_traces_thread_step',
    );

    // Drop constraint
    await queryRunner.query(`
      ALTER TABLE reasoning_traces 
      DROP CONSTRAINT IF EXISTS chk_reasoning_traces_status
    `);

    // Drop columns
    await queryRunner.dropColumn('reasoning_traces', 'step_index');
    await queryRunner.dropColumn('reasoning_traces', 'error');
    await queryRunner.dropColumn('reasoning_traces', 'duration_ms');
    await queryRunner.dropColumn('reasoning_traces', 'tool_results');
    await queryRunner.dropColumn('reasoning_traces', 'status');
  }
}
