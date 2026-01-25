import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeSearchWithFts1769325634000 implements MigrationInterface {
  name = 'OptimizeSearchWithFts1769325634000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add generated tsvector column
    await queryRunner.query(`
      ALTER TABLE "conversation_messages"
      ADD COLUMN "search_vector" tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce("content", ''))) STORED
    `);

    // 2. Create GIN index for fast full-text search
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_messages_search"
      ON "conversation_messages"
      USING GIN ("search_vector")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_conversation_messages_search"
    `);

    await queryRunner.query(`
      ALTER TABLE "conversation_messages"
      DROP COLUMN "search_vector"
    `);
  }
}
