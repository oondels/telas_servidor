import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterCorToVarchar1779884000000 implements MigrationInterface {
    name = 'AlterCorToVarchar1779884000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Altera o tipo da coluna cor de bigint para varchar. 
        // Usamos USING cor::varchar para garantir a compatibilidade com dados existentes.
        await queryRunner.query(`ALTER TABLE "fabrica"."controle_telas_prateleiras" ALTER COLUMN "cor" TYPE varchar USING "cor"::varchar`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Tenta reverter para bigint. 
        // Nota: Pode falhar se a coluna contiver strings não conversíveis, mas é a lógica de rollback correta.
        await queryRunner.query(`ALTER TABLE "fabrica"."controle_telas_prateleiras" ALTER COLUMN "cor" TYPE bigint USING "cor"::bigint`);
    }
}
