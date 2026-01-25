import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Migration: Create Conversations Table
 *
 * Creates the conversation table to store configuration and metadata.
 * Linked to users table.
 */
export class CreateConversationTable1769325635000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'conversations',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '255',
            isPrimary: true,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'config',
            type: 'jsonb',
            default: "'{}'",
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'NOW()',
          },
        ],
      }),
      true,
    );

    // Create indexes safely
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversations_user" ON "conversations" ("user_id");
    `);

    // Create foreign key to users (ON DELETE CASCADE) safely
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_conversations_user') THEN
          ALTER TABLE "conversations" 
          ADD CONSTRAINT "FK_conversations_user" 
          FOREIGN KEY ("user_id") 
          REFERENCES "users"("id") 
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.dropForeignKey('conversations', 'FK_conversations_user');

    // Drop indexes
    await queryRunner.dropIndex('conversations', 'IDX_conversations_user');

    // Drop table
    await queryRunner.dropTable('conversations');
  }
}
