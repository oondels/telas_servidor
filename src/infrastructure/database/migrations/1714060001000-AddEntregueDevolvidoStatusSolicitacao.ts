import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEntregueDevolvidoStatusSolicitacao1714060001000 implements MigrationInterface {
  name = "AddEntregueDevolvidoStatusSolicitacao1714060001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $migration$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type type_def
          JOIN pg_namespace namespace_def
            ON namespace_def.oid = type_def.typnamespace
          WHERE namespace_def.nspname = 'fabrica'
            AND type_def.typname = 'status_solicitacao'
        ) THEN
          ALTER TYPE fabrica."status_solicitacao" ADD VALUE IF NOT EXISTS 'entregue';
          ALTER TYPE fabrica."status_solicitacao" ADD VALUE IF NOT EXISTS 'devolvido';
        END IF;
      END
      $migration$;
    `);
  }

  public async down(): Promise<void> {
    // PostgreSQL não permite remover valores de enum de forma simples/segura.
  }
}
