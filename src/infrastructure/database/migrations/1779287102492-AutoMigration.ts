import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1779287102492 implements MigrationInterface {
    name = 'AutoMigration1779287102492'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "fabrica"."idx_controle_telas_status"`);
        await queryRunner.query(`DROP INDEX "fabrica"."idx_controle_telas_modelo"`);
        await queryRunner.query(`DROP INDEX "fabrica"."idx_controle_telas_codbarrastela"`);
        await queryRunner.query(`DROP INDEX "fabrica"."idx_telas_usuarios_role_active"`);
        await queryRunner.query(`DROP INDEX "fabrica"."idx_telas_audit_entity"`);
        await queryRunner.query(`DROP INDEX "fabrica"."idx_telas_audit_actor"`);
        await queryRunner.query(`CREATE TYPE "fabrica"."tipo_solicitacao" AS ENUM('NOVA', 'EXISTENTE', 'REPOSICAO')`);
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ADD "tipo" "fabrica"."tipo_solicitacao" NOT NULL DEFAULT 'NOVA'`);
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ADD CONSTRAINT "PK_aabae19a40d30001268bc3fc62f" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "data_pedido" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "created_at" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "updated_at" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "fabrica"."telas_usuarios" ALTER COLUMN "created_at" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "fabrica"."telas_usuarios" ALTER COLUMN "updated_at" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "fabrica"."telas_audit_events" ALTER COLUMN "created_at" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "fabrica"."telas_configuracoes" ALTER COLUMN "updated_at" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fabrica"."telas_configuracoes" ALTER COLUMN "updated_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "fabrica"."telas_audit_events" ALTER COLUMN "created_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "fabrica"."telas_usuarios" ALTER COLUMN "updated_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "fabrica"."telas_usuarios" ALTER COLUMN "created_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "updated_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "created_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "data_pedido" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" DROP CONSTRAINT "PK_aabae19a40d30001268bc3fc62f"`);
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" DROP COLUMN "tipo"`);
        await queryRunner.query(`DROP TYPE "fabrica"."tipo_solicitacao"`);
        await queryRunner.query(`CREATE INDEX "idx_telas_audit_actor" ON "fabrica"."telas_audit_events" ("actor_matricula", "created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_telas_audit_entity" ON "fabrica"."telas_audit_events" ("entity_type", "entity_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_telas_usuarios_role_active" ON "fabrica"."telas_usuarios" ("role", "active") `);
        await queryRunner.query(`CREATE INDEX "idx_controle_telas_codbarrastela" ON "fabrica"."controle_telas_prateleiras" ("codbarrastela") `);
        await queryRunner.query(`CREATE INDEX "idx_controle_telas_modelo" ON "fabrica"."controle_telas_prateleiras" ("modelo") `);
        await queryRunner.query(`CREATE INDEX "idx_controle_telas_status" ON "fabrica"."controle_telas_prateleiras" ("status") `);
    }

}
