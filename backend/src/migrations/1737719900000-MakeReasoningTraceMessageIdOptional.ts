import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Make reasoning_traces.messageId foreign key optional
 *
 * Problem:
 * - OrchestratorService creates placeholder assistant message before graph execution
 * - TracingCallbackHandler tries to link traces to messageId during execution
 * - Foreign key constraint requires messageId to exist in conversation_messages
 * - This causes "violates foreign key constraint" errors
 *
 * Solution:
 * - Drop the existing foreign key constraint
 * - Recreate it with ON DELETE SET NULL to make it optional
 * - This allows traces to be saved even if the message doesn't exist yet
 */
export class MakeReasoningTraceMessageIdOptional1737719900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "reasoning_traces" DROP CONSTRAINT IF EXISTS "FK_9a1233eca6df41752cc5e6cb9b1"`,
    );

    // Recreate the foreign key with ON DELETE SET NULL (optional)
    await queryRunner.query(
      `ALTER TABLE "reasoning_traces" 
       ADD CONSTRAINT "FK_reasoning_traces_message_id" 
       FOREIGN KEY ("messageId") 
       REFERENCES "conversation_messages"("id") 
       ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the optional foreign key
    await queryRunner.query(
      `ALTER TABLE "reasoning_traces" DROP CONSTRAINT IF EXISTS "FK_reasoning_traces_message_id"`,
    );

    // Recreate the original required foreign key
    await queryRunner.query(
      `ALTER TABLE "reasoning_traces" 
       ADD CONSTRAINT "FK_9a1233eca6df41752cc5e6cb9b1" 
       FOREIGN KEY ("messageId") 
       REFERENCES "conversation_messages"("id") 
       ON DELETE CASCADE`,
    );
  }
}
