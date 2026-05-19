import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ schema: "fabrica", name: "telas_audit_events" })
export class AuditEventOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 80 })
  entity_type!: string;

  @Column({ type: "varchar", length: 120 })
  entity_id!: string;

  @Column({ type: "varchar", length: 80 })
  action!: string;

  @Column({ type: "bigint", nullable: true })
  actor_matricula!: string | null;

  @Column({ type: "varchar", nullable: true })
  actor_usuario!: string | null;

  @Column({ type: "jsonb", nullable: true })
  before_state!: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  after_state!: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: "timestamptz" })
  created_at!: Date;
}
