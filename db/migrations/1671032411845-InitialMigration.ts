import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1671032411845 implements MigrationInterface {
  public name = 'InitialMigration1671032411845';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "actiony"."action_action_status_enum" AS ENUM('active', 'completed', 'failed', 'canceled')
        `);
    await queryRunner.query(`
            CREATE TABLE "actiony"."action" (
                "action_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "service" character varying NOT NULL,
                "state" integer NOT NULL,
                "rotation" character varying NOT NULL,
                "action_status" "actiony"."action_action_status_enum" NOT NULL DEFAULT 'active',
                "metadata" jsonb,
                "closed_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_5faf700dad0c8b77097ebefa533" PRIMARY KEY ("action_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_ff9f017f7c5f757d8a89a027e1" ON "actiony"."action" ("service")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "actiony"."IDX_ff9f017f7c5f757d8a89a027e1"
        `);
    await queryRunner.query(`
            DROP TABLE "actiony"."action"
        `);
    await queryRunner.query(`
            DROP TYPE "actiony"."action_action_status_enum"
        `);
  }
}
