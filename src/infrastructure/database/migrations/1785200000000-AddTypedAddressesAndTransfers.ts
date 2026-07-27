import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTypedAddressesAndTransfers1785200000000 implements MigrationInterface {
  name = "AddTypedAddressesAndTransfers1785200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fabrica"."telas_enderecos"
        ADD COLUMN "type" VARCHAR(30) NOT NULL DEFAULT 'INVENTARIO',
        ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      UPDATE "fabrica"."telas_enderecos"
      SET "metadata" = jsonb_build_object(
        'rua', split_part("address", '-', 1),
        'bloco', split_part("address", '-', 2),
        'nivel', split_part("address", '-', 3)
      )
      WHERE "type" = 'INVENTARIO'
        AND array_length(string_to_array("address", '-'), 1) = 3
    `);

    await queryRunner.query(`
      ALTER TABLE "fabrica"."controle_telas_prateleiras"
        ADD COLUMN "endereco_id" BIGINT
    `);

    await queryRunner.query(`
      UPDATE "fabrica"."controle_telas_prateleiras" AS tela
      SET "endereco_id" = endereco."id"
      FROM "fabrica"."telas_enderecos" AS endereco
      WHERE UPPER(COALESCE(tela."endereco", '')) = UPPER(endereco."address")
    `);

    await queryRunner.query(`
      ALTER TABLE "fabrica"."controle_telas_prateleiras"
      ADD CONSTRAINT "fk_controle_telas_endereco"
      FOREIGN KEY ("endereco_id")
      REFERENCES "fabrica"."telas_enderecos"("id")
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_telas_enderecos_type_active"
      ON "fabrica"."telas_enderecos" ("type", "active")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_controle_telas_endereco_id"
      ON "fabrica"."controle_telas_prateleiras" ("endereco_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "fabrica"."idx_controle_telas_endereco_id"`);
    await queryRunner.query(`DROP INDEX "fabrica"."idx_telas_enderecos_type_active"`);
    await queryRunner.query(`
      ALTER TABLE "fabrica"."controle_telas_prateleiras"
      DROP CONSTRAINT "fk_controle_telas_endereco"
    `);
    await queryRunner.query(`
      ALTER TABLE "fabrica"."controle_telas_prateleiras"
      DROP COLUMN "endereco_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "fabrica"."telas_enderecos"
        DROP COLUMN "active",
        DROP COLUMN "metadata",
        DROP COLUMN "type"
    `);
  }
}
