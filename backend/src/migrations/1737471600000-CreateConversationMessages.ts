import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Migration: Create Conversation Messages Table
 *
 * Creates the conversation_messages table for reliable message persistence.
 * This table stores user and assistant messages for conversation display,
 * separate from reasoning traces (which are used for debugging/observability).
 *
 * Features:
 * - Links messages to threads and users (required for security)
 * - Tracks message type (user, assistant, system)
 * - Stores message content with sequence numbers for ordering
 * - JSONB metadata for extensibility (trace links, reactions, editing)
 * - Composite unique constraint on (threadId, sequence) for ordering integrity
 * - Cascade delete when user is deleted
 *
 * This migration supports Chat Message Persistence (Solution A)
 * as specified in Chat_Message_Persistence.md.
 */
export class CreateConversationMessages1737471600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create conversation_messages table
    await queryRunner.createTable(
      new Table({
        name: 'conversation_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
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
            name: 'type',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'sequence',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
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

    // Add CHECK constraint safely
    // Add CHECK constraint safely
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_conversation_messages_type') THEN
          ALTER TABLE conversation_messages
          ADD CONSTRAINT chk_conversation_messages_type
          CHECK (type IN ('user', 'assistant', 'system'));
        END IF;
      END $$;
    `);

    // Create foreign key to users (ON DELETE CASCADE) safely
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_conversation_messages_user') THEN
          ALTER TABLE "conversation_messages" 
          ADD CONSTRAINT "FK_conversation_messages_user" 
          FOREIGN KEY ("user_id") 
          REFERENCES "users"("id") 
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Create indexes safely
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversation_messages_thread_sequence" ON "conversation_messages" ("thread_id", "sequence");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversation_messages_thread_id" ON "conversation_messages" ("thread_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversation_messages_thread_created" ON "conversation_messages" ("thread_id", "created_at");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversation_messages_user_id" ON "conversation_messages" ("user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      'conversation_messages',
      'IDX_conversation_messages_user_id',
    );
    await queryRunner.dropIndex(
      'conversation_messages',
      'IDX_conversation_messages_thread_created',
    );
    await queryRunner.dropIndex(
      'conversation_messages',
      'IDX_conversation_messages_thread_id',
    );
    await queryRunner.dropIndex(
      'conversation_messages',
      'IDX_conversation_messages_thread_sequence',
    );

    // Drop foreign key
    await queryRunner.dropForeignKey(
      'conversation_messages',
      'FK_conversation_messages_user',
    );

    // Drop CHECK constraint
    await queryRunner.query(`
      ALTER TABLE conversation_messages
      DROP CONSTRAINT IF EXISTS chk_conversation_messages_type
    `);

    // Drop table
    await queryRunner.dropTable('conversation_messages');
  }
}
