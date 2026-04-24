import { MigrationInterface, QueryRunner } from "typeorm";

export class LegacyControleTelasSchema1714060000000 implements MigrationInterface {
  name = "LegacyControleTelasSchema1714060000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE fabrica.controle_telas_prateleiras
      ADD COLUMN IF NOT EXISTS pecas text;
    `);

    await queryRunner.query(`
      ALTER TABLE fabrica.controle_telas_prateleiras
      ADD COLUMN IF NOT EXISTS tamanho_etiqueta varchar(16);
    `);

    await queryRunner.query(`
      ALTER TABLE fabrica.controle_telas_prateleiras
      ALTER COLUMN codbarrastela TYPE varchar(40) USING codbarrastela::varchar;
    `);

    await queryRunner.query(`
      DO $migration$
      DECLARE
        has_peca_column boolean := false;
        pecas_data_type text := 'text';
      BEGIN
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'fabrica'
            AND table_name = 'controle_telas_prateleiras'
            AND column_name = 'peca'
        )
        INTO has_peca_column;

        SELECT COALESCE(data_type, 'text')
        INTO pecas_data_type
        FROM information_schema.columns
        WHERE table_schema = 'fabrica'
          AND table_name = 'controle_telas_prateleiras'
          AND column_name = 'pecas';

        IF pecas_data_type = 'jsonb' THEN
          IF has_peca_column THEN
            EXECUTE $sql$
              UPDATE fabrica.controle_telas_prateleiras
              SET pecas = COALESCE(
                pecas,
                CASE
                  WHEN peca IS NULL OR BTRIM(peca) = '' THEN '[]'::jsonb
                  ELSE to_jsonb(string_to_array(REPLACE(peca, ' / ', '/'), '/'))
                END
              )
              WHERE pecas IS NULL;
            $sql$;
          ELSE
            EXECUTE $sql$
              UPDATE fabrica.controle_telas_prateleiras
              SET pecas = COALESCE(pecas, '[]'::jsonb)
              WHERE pecas IS NULL;
            $sql$;
          END IF;
        ELSIF pecas_data_type = 'json' THEN
          IF has_peca_column THEN
            EXECUTE $sql$
              UPDATE fabrica.controle_telas_prateleiras
              SET pecas = COALESCE(
                pecas,
                CASE
                  WHEN peca IS NULL OR BTRIM(peca) = '' THEN '[]'::json
                  ELSE to_json(string_to_array(REPLACE(peca, ' / ', '/'), '/'))
                END
              )
              WHERE pecas IS NULL;
            $sql$;
          ELSE
            EXECUTE $sql$
              UPDATE fabrica.controle_telas_prateleiras
              SET pecas = COALESCE(pecas, '[]'::json)
              WHERE pecas IS NULL;
            $sql$;
          END IF;
        ELSE
          IF has_peca_column THEN
            EXECUTE $sql$
              UPDATE fabrica.controle_telas_prateleiras
              SET pecas = COALESCE(
                pecas,
                CASE
                  WHEN peca IS NULL OR BTRIM(peca) = '' THEN '[]'
                  ELSE to_json(string_to_array(REPLACE(peca, ' / ', '/'), '/'))::text
                END
              )
              WHERE pecas IS NULL;
            $sql$;
          ELSE
            EXECUTE $sql$
              UPDATE fabrica.controle_telas_prateleiras
              SET pecas = COALESCE(pecas, '[]')
              WHERE pecas IS NULL;
            $sql$;
          END IF;
        END IF;
      END
      $migration$;
    `);

    await queryRunner.query(`
      UPDATE fabrica.controle_telas_prateleiras
      SET status = 'PRODUCAO'
      WHERE status IS NULL OR BTRIM(status) = '';
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_controle_telas_codbarrastela
      ON fabrica.controle_telas_prateleiras USING btree (codbarrastela);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_controle_telas_status
      ON fabrica.controle_telas_prateleiras USING btree (status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_controle_telas_modelo
      ON fabrica.controle_telas_prateleiras USING btree (modelo);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS fabrica.idx_controle_telas_modelo;`);
    await queryRunner.query(`DROP INDEX IF EXISTS fabrica.idx_controle_telas_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS fabrica.idx_controle_telas_codbarrastela;`);
  }
}
