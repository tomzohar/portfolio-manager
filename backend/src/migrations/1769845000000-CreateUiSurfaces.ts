import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUiSurfaces1769845000000 implements MigrationInterface {
  name = 'CreateUiSurfaces1769845000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "ui_surfaces" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "threadId" character varying NOT NULL,
                "userId" uuid NOT NULL,
                "components" jsonb NOT NULL DEFAULT '[]',
                "dataModel" jsonb NOT NULL DEFAULT '{}',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ui_surfaces_id" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_ui_surfaces_threadId_userId" ON "ui_surfaces" ("threadId", "userId")
        `);
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_ui_surfaces_threadId" ON "ui_surfaces" ("threadId")
        `);
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_ui_surfaces_userId" ON "ui_surfaces" ("userId")
        `);

    // Use a block to safely add constraint only if it doesn't exist (simulated via drop if exists)
    await queryRunner.query(`
            ALTER TABLE "ui_surfaces" 
            DROP CONSTRAINT IF EXISTS "FK_ui_surfaces_userId"
        `);

    await queryRunner.query(`
            ALTER TABLE "ui_surfaces" 
            ADD CONSTRAINT "FK_ui_surfaces_userId" 
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ui_surfaces" DROP CONSTRAINT "FK_ui_surfaces_userId"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_ui_surfaces_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_ui_surfaces_threadId"`);
    await queryRunner.query(`DROP INDEX "IDX_ui_surfaces_threadId_userId"`);
    await queryRunner.query(`DROP TABLE "ui_surfaces"`);
  }
}
