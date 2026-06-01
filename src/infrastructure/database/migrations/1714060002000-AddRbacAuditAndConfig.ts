import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRbacAuditAndConfig1714060002000 implements MigrationInterface {
  name = "AddRbacAuditAndConfig1714060002000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await queryRunner.query(`
      DO $migration$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type type_def
          JOIN pg_namespace namespace_def ON namespace_def.oid = type_def.typnamespace
          WHERE namespace_def.nspname = 'fabrica'
            AND type_def.typname = 'telas_usuario_role'
        ) THEN
          CREATE TYPE fabrica.telas_usuario_role AS ENUM (
            'ADMIN',
            'OPERADOR_TELAS',
            'MOVIMENTADOR',
            'USUARIO_PRODUCAO'
          );
        END IF;
      END
      $migration$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fabrica.telas_usuarios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        matricula bigint NOT NULL UNIQUE,
        nome varchar NULL,
        usuario varchar NULL,
        setor varchar NULL,
        unidade varchar NULL,
        role fabrica.telas_usuario_role NOT NULL DEFAULT 'USUARIO_PRODUCAO',
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fabrica.telas_audit_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type varchar(80) NOT NULL,
        entity_id varchar(120) NOT NULL,
        action varchar(80) NOT NULL,
        actor_matricula bigint NULL,
        actor_usuario varchar NULL,
        before_state jsonb NULL,
        after_state jsonb NULL,
        metadata jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fabrica.telas_configuracoes (
        key varchar(80) PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        updated_by bigint NULL
      );
    `);

    await queryRunner.query(`
      INSERT INTO fabrica.telas_configuracoes (key, value)
      VALUES ('telas_sem_movimentacao', '{"days": 30}'::jsonb)
      ON CONFLICT (key) DO NOTHING;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_telas_usuarios_role_active
      ON fabrica.telas_usuarios USING btree (role, active);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_telas_audit_entity
      ON fabrica.telas_audit_events USING btree (entity_type, entity_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_telas_audit_actor
      ON fabrica.telas_audit_events USING btree (actor_matricula, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS fabrica.idx_telas_audit_actor;`);
    await queryRunner.query(`DROP INDEX IF EXISTS fabrica.idx_telas_audit_entity;`);
    await queryRunner.query(`DROP INDEX IF EXISTS fabrica.idx_telas_usuarios_role_active;`);
    await queryRunner.query(`DROP TABLE IF EXISTS fabrica.telas_configuracoes;`);
    await queryRunner.query(`DROP TABLE IF EXISTS fabrica.telas_audit_events;`);
    await queryRunner.query(`DROP TABLE IF EXISTS fabrica.telas_usuarios;`);
    await queryRunner.query(`DROP TYPE IF EXISTS fabrica.telas_usuario_role;`);
  }
}
