import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTelasEnderecosTable1779883000000 implements MigrationInterface {
    name = 'CreateTelasEnderecosTable1779883000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "fabrica"."telas_enderecos" (
                "id" BIGSERIAL PRIMARY KEY,
                "address" VARCHAR(50) NOT NULL UNIQUE,
                "vagas" INTEGER NOT NULL,
                "barcode" VARCHAR(40) NOT NULL UNIQUE,
                "usercreate" VARCHAR(100) NOT NULL,
                "user_edit" VARCHAR(100),
                "created_ad" TIMESTAMP NOT NULL DEFAULT now(),
                "edited_at" TIMESTAMP
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "fabrica"."telas_enderecos"`);
    }
}
