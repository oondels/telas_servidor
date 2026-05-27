import { MigrationInterface, QueryRunner } from "typeorm";

export class UuidDefault1779881632172 implements MigrationInterface {
    name = 'UuidDefault1779881632172'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fabrica"."solicitacao_tela" ALTER COLUMN "id" DROP DEFAULT`);
    }

}
