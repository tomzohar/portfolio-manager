import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageIdToReasoningTrace1769254970438 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add messageId column to reasoning_traces table safely
    await queryRunner.query(`
            ALTER TABLE "reasoning_traces" 
            ADD COLUMN IF NOT EXISTS "messageId" uuid
        `);

    // Add index on messageId for efficient querying safely
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_reasoning_traces_messageId" 
            ON "reasoning_traces" ("messageId")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first
    await queryRunner.query(`
            DROP INDEX "IDX_reasoning_traces_messageId"
        `);

    // Drop messageId column
    await queryRunner.query(`
            ALTER TABLE "reasoning_traces" 
            DROP COLUMN "messageId"
        `);
  }
}
