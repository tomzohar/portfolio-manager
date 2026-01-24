import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

/**
 * Migration: Create HITL Approvals Table for US-003
 *
 * Creates the hitl_approvals table for Human-in-the-Loop approval gates.
 * Enables cost threshold approvals and user consent before executing
 * expensive analysis operations.
 *
 * Features:
 * - Links approvals to threads and users (required for security)
 * - Tracks approval status (pending, approved, rejected, expired)
 * - Stores approval context (cost estimates, analysis plans)
 * - Supports expiration for time-limited approvals
 * - Cascade delete when user is deleted
 *
 * This migration supports US-003: HITL Approval System
 * from the Digital CIO Chat Interface feature.
 */
export class CreateHitlApprovals1737470400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create hitl_approvals table
    await queryRunner.createTable(
      new Table({
        name: 'hitl_approvals',
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
            name: 'approval_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'prompt',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'user_response',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'responded_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
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

    // Add CHECK constraint for status values
    await queryRunner.query(`
      ALTER TABLE hitl_approvals
      ADD CONSTRAINT chk_hitl_approvals_status
      CHECK (status IN ('pending', 'approved', 'rejected', 'expired'))
    `);

    // Create foreign key to users (ON DELETE CASCADE)
    await queryRunner.createForeignKey(
      'hitl_approvals',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_hitl_approvals_user',
      }),
    );

    // Create index on thread_id for efficient queries
    await queryRunner.createIndex(
      'hitl_approvals',
      new TableIndex({
        name: 'IDX_hitl_approvals_thread_id',
        columnNames: ['thread_id'],
      }),
    );

    // Create index on user_id for security filtering
    await queryRunner.createIndex(
      'hitl_approvals',
      new TableIndex({
        name: 'IDX_hitl_approvals_user_id',
        columnNames: ['user_id'],
      }),
    );

    // Create index on status for filtering pending approvals
    await queryRunner.createIndex(
      'hitl_approvals',
      new TableIndex({
        name: 'IDX_hitl_approvals_status',
        columnNames: ['status'],
      }),
    );

    // Create partial index on expires_at for pending approvals only
    await queryRunner.query(`
      CREATE INDEX IDX_hitl_approvals_expires_at
      ON hitl_approvals(expires_at)
      WHERE status = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_hitl_approvals_expires_at',
    );
    await queryRunner.dropIndex('hitl_approvals', 'IDX_hitl_approvals_status');
    await queryRunner.dropIndex('hitl_approvals', 'IDX_hitl_approvals_user_id');
    await queryRunner.dropIndex(
      'hitl_approvals',
      'IDX_hitl_approvals_thread_id',
    );

    // Drop foreign key
    await queryRunner.dropForeignKey(
      'hitl_approvals',
      'FK_hitl_approvals_user',
    );

    // Drop CHECK constraint
    await queryRunner.query(`
      ALTER TABLE hitl_approvals
      DROP CONSTRAINT IF EXISTS chk_hitl_approvals_status
    `);

    // Drop table
    await queryRunner.dropTable('hitl_approvals');
  }
}
