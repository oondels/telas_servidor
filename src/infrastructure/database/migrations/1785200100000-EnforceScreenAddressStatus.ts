import { MigrationInterface, QueryRunner } from "typeorm";

export class EnforceScreenAddressStatus1785200100000 implements MigrationInterface {
  name = "EnforceScreenAddressStatus1785200100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "fabrica"."sync_tela_endereco_status"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        destination_type VARCHAR(30);
      BEGIN
        IF NEW."endereco" IS NULL OR BTRIM(NEW."endereco") = '' THEN
          NEW."endereco" := NULL;
          NEW."endereco_id" := NULL;
          NEW."status" := 'SEM_ENDERECO';
          RETURN NEW;
        END IF;

        IF NEW."endereco_id" IS NOT NULL THEN
          SELECT "type"
          INTO destination_type
          FROM "fabrica"."telas_enderecos"
          WHERE "id" = NEW."endereco_id";

          IF destination_type = 'PRODUCAO' THEN
            NEW."status" := 'PRODUCAO';
          ELSIF destination_type = 'INVENTARIO' THEN
            NEW."status" := 'ARMAZENADA';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE TRIGGER "trg_sync_tela_endereco_status"
      BEFORE INSERT OR UPDATE OF "endereco", "endereco_id"
      ON "fabrica"."controle_telas_prateleiras"
      FOR EACH ROW
      EXECUTE FUNCTION "fabrica"."sync_tela_endereco_status"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_sync_tela_endereco_status"
      ON "fabrica"."controle_telas_prateleiras"
    `);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "fabrica"."sync_tela_endereco_status"()`);
  }
}
