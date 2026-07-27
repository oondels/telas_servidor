import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTipoToTelasEnderecos1785122200000 implements MigrationInterface {
  name = "AddTipoToTelasEnderecos1785122200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE fabrica.telas_enderecos
        ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'INVENTARIO',
        ADD COLUMN nome VARCHAR(30),
        ADD COLUMN numero INTEGER
    `);
    await queryRunner.query(`
      ALTER TABLE fabrica.telas_enderecos
        ADD CONSTRAINT ck_telas_enderecos_tipo
        CHECK (tipo IN ('INVENTARIO', 'PRODUCAO'))
    `);
    await queryRunner.query(`
      ALTER TABLE fabrica.telas_enderecos
        ADD CONSTRAINT ck_telas_enderecos_producao
        CHECK (
          (tipo = 'INVENTARIO' AND nome IS NULL AND numero IS NULL)
          OR
          (tipo = 'PRODUCAO' AND nome IS NOT NULL AND numero IS NOT NULL AND numero > 0)
        )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_telas_enderecos_tipo
      ON fabrica.telas_enderecos (tipo)
    `);
    await queryRunner.query(`
      UPDATE fabrica.controle_telas_prateleiras
      SET status = 'SEM_ENDERECO'
      WHERE endereco IS NULL OR BTRIM(endereco) = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE fabrica.controle_telas_prateleiras
      SET status = 'PRODUCAO'
      WHERE status = 'SEM_ENDERECO'
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS fabrica.idx_telas_enderecos_tipo`);
    await queryRunner.query(`ALTER TABLE fabrica.telas_enderecos DROP CONSTRAINT IF EXISTS ck_telas_enderecos_producao`);
    await queryRunner.query(`ALTER TABLE fabrica.telas_enderecos DROP CONSTRAINT IF EXISTS ck_telas_enderecos_tipo`);
    await queryRunner.query(`
      ALTER TABLE fabrica.telas_enderecos
        DROP COLUMN IF EXISTS numero,
        DROP COLUMN IF EXISTS nome,
        DROP COLUMN IF EXISTS tipo
    `);
  }
}
