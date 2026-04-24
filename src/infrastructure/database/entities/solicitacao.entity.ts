import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ schema: "fabrica", name: "solicitacao_tela" })
export class SolicitacaoOrmEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ type: "bigint" })
  solicitante!: string;

  @Column({ type: "jsonb" })
  dados_pedido!: Record<string, unknown>;

  @Column({ type: "text", nullable: true })
  motivo!: string | null;

  @Column({ type: "text", nullable: true })
  observacao_pedido!: string | null;

  @Column({ type: "varchar", nullable: true })
  turno_pedido!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  data_pedido!: Date | null;

  @Column({ type: "enum", enumName: "status_solicitacao", enum: [
    "pedido",
    "aceito",
    "reprovado",
    "gravacao",
    "setor_em_manutencao",
    "concluido",
    "entregue",
    "devolvido",
  ], nullable: true })
  status!: string | null;

  @Column({ type: "boolean", default: false })
  entregue!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  data_entrega!: Date | null;

  @Column({ type: "bigint", nullable: true })
  user_recebimento!: string | null;

  @Column({ type: "bigint", nullable: true })
  user_conferente!: string | null;

  @Column({ type: "text", nullable: true })
  observacao_conferente!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  created_at!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  updated_at!: Date | null;

  @Column({ type: "bigint", nullable: true })
  updated_by!: string | null;
}
