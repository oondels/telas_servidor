import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueTelaBarcode1779885000000 implements MigrationInterface {
  name = "AddUniqueTelaBarcode1779885000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicates = await queryRunner.query(`
      SELECT UPPER(BTRIM(codbarrastela)) AS codigo, COUNT(*)::int AS total
      FROM fabrica.controle_telas_prateleiras
      WHERE NULLIF(BTRIM(codbarrastela), '') IS NOT NULL
      GROUP BY UPPER(BTRIM(codbarrastela))
      HAVING COUNT(*) > 1
      LIMIT 1
    `);
    if (duplicates.length) {
      throw new Error(`Não foi possível criar a unicidade de códigos: o código ${duplicates[0].codigo} já está duplicado. Saneie os dados antes de executar esta migração.`);
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_controle_telas_codbarrastela_normalizado
      ON fabrica.controle_telas_prateleiras (UPPER(BTRIM(codbarrastela)))
      WHERE NULLIF(BTRIM(codbarrastela), '') IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS fabrica.uq_controle_telas_codbarrastela_normalizado`);
  }
}
