import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

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

    // Add CHECK constraint for type values
    await queryRunner.query(`
      ALTER TABLE conversation_messages
      ADD CONSTRAINT chk_conversation_messages_type
      CHECK (type IN ('user', 'assistant', 'system'))
    `);

    // Create foreign key to users (ON DELETE CASCADE)
    await queryRunner.createForeignKey(
      'conversation_messages',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_conversation_messages_user',
      }),
    );

    // Create composite unique index on thread_id + sequence for ordering integrity
    await queryRunner.createIndex(
      'conversation_messages',
      new TableIndex({
        name: 'IDX_conversation_messages_thread_sequence',
        columnNames: ['thread_id', 'sequence'],
        isUnique: true,
      }),
    );

    // Create index on thread_id for efficient thread queries
    await queryRunner.createIndex(
      'conversation_messages',
      new TableIndex({
        name: 'IDX_conversation_messages_thread_id',
        columnNames: ['thread_id'],
      }),
    );

    // Create composite index on thread_id + created_at for chronological queries
    await queryRunner.createIndex(
      'conversation_messages',
      new TableIndex({
        name: 'IDX_conversation_messages_thread_created',
        columnNames: ['thread_id', 'created_at'],
      }),
    );

    // Create index on user_id for security filtering
    await queryRunner.createIndex(
      'conversation_messages',
      new TableIndex({
        name: 'IDX_conversation_messages_user_id',
        columnNames: ['user_id'],
      }),
    );
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
