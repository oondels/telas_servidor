import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { USER_ROLES, UserRole } from "../../../modules/users/domain/user-role.js";

@Entity({ schema: "fabrica", name: "telas_usuarios" })
export class AppUserOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "bigint", unique: true })
  matricula!: string;

  @Column({ type: "varchar", nullable: true })
  nome!: string | null;

  @Column({ type: "varchar", nullable: true })
  usuario!: string | null;

  @Column({ type: "varchar", nullable: true })
  setor!: string | null;

  @Column({ type: "varchar", nullable: true })
  unidade!: string | null;

  @Column({
    type: "enum",
    enumName: "telas_usuario_role",
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.USUARIO_PRODUCAO,
  })
  role!: UserRole;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @Column({ type: "timestamptz" })
  created_at!: Date;

  @Column({ type: "timestamptz" })
  updated_at!: Date;
}
