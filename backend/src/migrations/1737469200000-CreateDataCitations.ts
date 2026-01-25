import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Migration: Create Data Citations Table for US-002
 *
 * Creates the data_citations table to link reasoning traces to their data sources.
 * Enables transparency by tracking which external data (FRED, Polygon, NewsAPI, etc.)
 * was used to generate specific claims in the agent's reasoning.
 *
 * Features:
 * - Links citations to reasoning traces (optional, can be NULL)
 * - Links citations to threads and users (required for security)
 * - Stores source metadata (type, identifier, data point)
 * - Stores citation text and position for inline citations
 * - Cascade delete when trace or user is deleted
 *
 * This migration supports US-002: Data Source Citation System
 * from the Digital CIO Chat Interface feature.
 */
export class CreateDataCitations1737469200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create data_citations table
    await queryRunner.createTable(
      new Table({
        name: 'data_citations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'reasoning_trace_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'thread_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'source_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'source_identifier',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'data_point',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'citation_text',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'position_in_text',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'NOW()',
          },
        ],
      }),
      true,
    );

    // Create foreign keys safely using DO blocks
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_data_citations_reasoning_trace') THEN
          ALTER TABLE "data_citations" 
          ADD CONSTRAINT "FK_data_citations_reasoning_trace" 
          FOREIGN KEY ("reasoning_trace_id") 
          REFERENCES "reasoning_traces"("id") 
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_data_citations_user') THEN
          ALTER TABLE "data_citations" 
          ADD CONSTRAINT "FK_data_citations_user" 
          FOREIGN KEY ("user_id") 
          REFERENCES "users"("id") 
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Create indexes safely using IF NOT EXISTS
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_data_citations_thread_id" ON "data_citations" ("thread_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_data_citations_user_id" ON "data_citations" ("user_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_data_citations_trace_id" ON "data_citations" ("reasoning_trace_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_data_citations_source" ON "data_citations" ("source_type", "source_identifier");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('data_citations', 'IDX_data_citations_source');
    await queryRunner.dropIndex(
      'data_citations',
      'IDX_data_citations_trace_id',
    );
    await queryRunner.dropIndex('data_citations', 'IDX_data_citations_user_id');
    await queryRunner.dropIndex(
      'data_citations',
      'IDX_data_citations_thread_id',
    );

    // Drop foreign keys
    await queryRunner.dropForeignKey(
      'data_citations',
      'FK_data_citations_user',
    );
    await queryRunner.dropForeignKey(
      'data_citations',
      'FK_data_citations_reasoning_trace',
    );

    // Drop table
    await queryRunner.dropTable('data_citations');
  }
}
