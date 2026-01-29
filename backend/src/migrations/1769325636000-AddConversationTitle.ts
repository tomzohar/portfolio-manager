import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConversationTitle1769325636000 implements MigrationInterface {
    name = 'AddConversationTitle1769325636000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversations" ADD "title" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "title"`);
    }

}
