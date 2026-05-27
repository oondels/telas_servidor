import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSkuToTelas1779882000000 implements MigrationInterface {
    name = 'AddSkuToTelas1779882000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fabrica"."controle_telas_prateleiras" ADD COLUMN "sku" varchar`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fabrica"."controle_telas_prateleiras" DROP COLUMN "sku"`);
    }
}
