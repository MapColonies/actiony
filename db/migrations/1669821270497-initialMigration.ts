import { MigrationInterface, QueryRunner } from 'typeorm';

export class initialMigration1669821270497 implements MigrationInterface {
  name = 'initialMigration1669821270497';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "action"."action_action_status_enum" AS ENUM('active', 'completed', 'failed', 'canceled')
        `);
    await queryRunner.query(`
            CREATE TABLE "action"."action" (
                "action_id" uuid NOT NULL,
                "service" character varying NOT NULL,
                "state" integer NOT NULL,
                "action_status" "action"."action_action_status_enum" NOT NULL,
                "metadata" jsonb,
                "closed_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_5faf700dad0c8b77097ebefa533" PRIMARY KEY ("action_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_ff9f017f7c5f757d8a89a027e1" ON "action"."action" ("service")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "action"."IDX_ff9f017f7c5f757d8a89a027e1"
        `);
    await queryRunner.query(`
            DROP TABLE "action"."action"
        `);
    await queryRunner.query(`
            DROP TYPE "action"."action_action_status_enum"
        `);
  }
}
