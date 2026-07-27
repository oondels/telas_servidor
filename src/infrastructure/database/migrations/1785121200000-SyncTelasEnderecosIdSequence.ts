import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncTelasEnderecosIdSequence1785121200000 implements MigrationInterface {
  name = "SyncTelasEnderecosIdSequence1785121200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $migration$
      DECLARE
        sequence_name text;
        max_id bigint;
      BEGIN
        IF to_regclass('fabrica.telas_enderecos') IS NULL THEN
          RETURN;
        END IF;

        SELECT pg_get_serial_sequence('fabrica.telas_enderecos', 'id')
        INTO sequence_name;

        IF sequence_name IS NULL THEN
          RETURN;
        END IF;

        SELECT MAX(id)
        INTO max_id
        FROM fabrica.telas_enderecos;

        IF max_id IS NULL THEN
          PERFORM setval(sequence_name::regclass, 1, false);
        ELSE
          PERFORM setval(sequence_name::regclass, max_id, true);
        END IF;
      END
      $migration$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Sequence synchronization is corrective and has no safe rollback.
  }
}
