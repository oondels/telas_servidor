import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ schema: "fabrica", name: "controle_telas_prateleiras" })
export class TelaOrmEntity {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: string;

  @Column({ type: "timestamp", nullable: true })
  createdate!: Date | null;

  @Column({ type: "timestamp", nullable: true })
  updatedate!: Date | null;

  @Column({ type: "varchar", nullable: true })
  usuariocreate!: string | null;

  @Column({ type: "varchar", nullable: true })
  marca!: string | null;

  @Column({ type: "varchar", nullable: true })
  modelo!: string | null;

  @Column({ type: "varchar", nullable: true })
  numerotela!: string | null;

  @Column({ type: "bigint", nullable: true })
  cor!: string | null;

  @Column({ type: "bigint", nullable: true })
  fios!: string | null;

  @Column({ type: "date", nullable: true })
  datafabricacao!: string | null;

  @Column({ type: "varchar", nullable: true })
  peca!: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  codbarrastela!: string | null;

  @Column({ type: "varchar", nullable: true })
  endereco!: string | null;

  @Column({ type: "varchar", nullable: true })
  usuarioendereco!: string | null;

  @Column({ type: "varchar", nullable: true })
  status!: string | null;

  @Column({ type: "varchar", nullable: true })
  usuariostatus!: string | null;

  @Column({ type: "varchar", nullable: true })
  usuarioaltera!: string | null;

  @Column({ type: "text", nullable: true })
  pecas!: string | null;

  @Column({ type: "varchar", length: 16, nullable: true })
  tamanho_etiqueta!: string | null;
}
