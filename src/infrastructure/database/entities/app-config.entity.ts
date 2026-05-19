import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ schema: "fabrica", name: "telas_configuracoes" })
export class AppConfigOrmEntity {
  @PrimaryColumn({ type: "varchar", length: 80 })
  key!: string;

  @Column({ type: "jsonb" })
  value!: Record<string, unknown>;

  @Column({ type: "timestamptz" })
  updated_at!: Date;

  @Column({ type: "bigint", nullable: true })
  updated_by!: string | null;
}
