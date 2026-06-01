import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1779287102492 implements MigrationInterface {
    name = 'AutoMigration1779287102492'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "fabrica"."idx_controle_telas_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "fabrica"."idx_controle_telas_modelo"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "fabrica"."idx_controle_telas_codbarrastela"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "fabrica"."idx_telas_usuarios_role_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "fabrica"."idx_telas_audit_entity"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "fabrica"."idx_telas_audit_actor"`);
        
        await queryRunner.query(`
            DO $migration$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type type_def
                    JOIN pg_namespace namespace_def ON namespace_def.oid = type_def.typnamespace
                    WHERE namespace_def.nspname = 'fabrica' AND type_def.typname = 'tipo_solicitacao'
                ) THEN
                    CREATE TYPE "fabrica"."tipo_solicitacao" AS ENUM('NOVA', 'EXISTENTE', 'REPOSICAO');
                END IF;
            END
            $migration$;
        `);

        const tableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'fabrica' AND table_name = 'solicitacao_tela'
            );
        `);

        if (tableExists[0].exists) {
            await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ADD "tipo" "fabrica"."tipo_solicitacao" NOT NULL DEFAULT 'NOVA'`);
            await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ADD CONSTRAINT "PK_aabae19a40d30001268bc3fc62f" PRIMARY KEY ("id")`);
            await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "id" DROP DEFAULT`);
            await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "data_pedido" DROP DEFAULT`);
            await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "created_at" DROP DEFAULT`);
            await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "updated_at" DROP DEFAULT`);
        } else {
            await queryRunner.query(`
                DO $migration$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_type type_def
                        JOIN pg_namespace namespace_def ON namespace_def.oid = type_def.typnamespace
                        WHERE namespace_def.nspname = 'fabrica' AND type_def.typname = 'status_solicitacao'
                    ) THEN
                        CREATE TYPE "fabrica"."status_solicitacao" AS ENUM('pedido', 'aceito', 'reprovado', 'gravacao', 'setor_em_manutencao', 'concluido', 'entregue', 'devolvido');
                    END IF;
                END
                $migration$;
            `);
            await queryRunner.query(`
                CREATE TABLE "fabrica"."solicitacao_tela" (
                    "id" uuid NOT NULL,
                    "solicitante" bigint NOT NULL,
                    "dados_pedido" jsonb NOT NULL,
                    "motivo" text,
                    "observacao_pedido" text,
                    "turno_pedido" character varying,
                    "data_pedido" TIMESTAMP WITH TIME ZONE,
                    "tipo" "fabrica"."tipo_solicitacao" NOT NULL DEFAULT 'NOVA',
                    "status" "fabrica"."status_solicitacao",
                    "entregue" boolean NOT NULL DEFAULT false,
                    "data_entrega" TIMESTAMP WITH TIME ZONE,
                    "user_recebimento" bigint,
                    "user_conferente" bigint,
                    "observacao_conferente" text,
                    "created_at" TIMESTAMP WITH TIME ZONE,
                    "updated_at" TIMESTAMP WITH TIME ZONE,
                    "updated_by" bigint,
                    CONSTRAINT "PK_aabae19a40d30001268bc3fc62f" PRIMARY KEY ("id")
                )
            `);
        }

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
        
        const tableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'fabrica' AND table_name = 'solicitacao_tela'
            );
        `);
        
        if (tableExists[0].exists) {
            try {
                await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "updated_at" SET DEFAULT now()`);
                await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "created_at" SET DEFAULT now()`);
                await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "data_pedido" SET DEFAULT now()`);
                await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`);
                await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" DROP CONSTRAINT "PK_aabae19a40d30001268bc3fc62f"`);
                await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" DROP COLUMN "tipo"`);
            } catch (e) {
                await queryRunner.query(`DROP TABLE "fabrica"."solicitacao_tela"`);
            }
        }
        await queryRunner.query(`DROP TYPE IF EXISTS "fabrica"."tipo_solicitacao"`);
        
        await queryRunner.query(`CREATE INDEX "idx_telas_audit_actor" ON "fabrica"."telas_audit_events" ("actor_matricula", "created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_telas_audit_entity" ON "fabrica"."telas_audit_events" ("entity_type", "entity_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_telas_usuarios_role_active" ON "fabrica"."telas_usuarios" ("role", "active") `);
        await queryRunner.query(`CREATE INDEX "idx_controle_telas_codbarrastela" ON "fabrica"."controle_telas_prateleiras" ("codbarrastela") `);
        await queryRunner.query(`CREATE INDEX "idx_controle_telas_modelo" ON "fabrica"."controle_telas_prateleiras" ("modelo") `);
        await queryRunner.query(`CREATE INDEX "idx_controle_telas_status" ON "fabrica"."controle_telas_prateleiras" ("status") `);
    }
}
