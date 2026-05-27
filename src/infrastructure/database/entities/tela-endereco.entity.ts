import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ schema: "fabrica", name: "telas_enderecos" })
export class TelaEnderecoOrmEntity {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: string;

  @Column({ type: "varchar", length: 50, unique: true })
  address!: string;

  @Column({ type: "integer" })
  vagas!: number;

  @Column({ type: "varchar", length: 40, unique: true })
  barcode!: string;

  @Column({ type: "varchar", length: 100 })
  usercreate!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  user_edit!: string | null;

  @Column({ type: "timestamp", default: () => "now()" })
  created_ad!: Date;

  @Column({ type: "timestamp", nullable: true })
  edited_at!: Date | null;
}
