import { DataSource } from "typeorm";
import { AppUserOrmEntity } from "../../../infrastructure/database/entities/app-user.entity.js";
import { AppError } from "../../../shared/domain/errors/app-error.js";
import { toBahiaSqlDateTime } from "../../../shared/utils/date.js";
import { AppUser } from "../domain/app-user.js";
import { normalizeUserRole, USER_ROLES } from "../domain/user-role.js";
import { CreateUserInput, SearchUsersInput, UpdateUserInput } from "../application/users.dto.js";

const mapUser = (entity: AppUserOrmEntity): AppUser => ({
  id: entity.id,
  matricula: Number(entity.matricula),
  nome: entity.nome,
  usuario: entity.usuario,
  setor: entity.setor,
  unidade: entity.unidade,
  role: entity.role,
  active: entity.active,
  createdAt: entity.created_at,
  updatedAt: entity.updated_at,
});

const normalizeText = (value: unknown) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
};

export class TypeOrmUsersRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findActiveByMatricula(matricula: number): Promise<AppUser | null> {
    const entity = await this.dataSource.getRepository(AppUserOrmEntity).findOne({
      where: { matricula: String(matricula), active: true },
    });

    return entity ? mapUser(entity) : null;
  }

  async search(input: SearchUsersInput) {
    const params: unknown[] = [];
    const where: string[] = [];
    const search = String(input.search ?? "").trim().toUpperCase();

    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        CAST(matricula AS TEXT) LIKE $${params.length}
        OR UPPER(COALESCE(nome, '')) LIKE $${params.length}
        OR UPPER(COALESCE(usuario, '')) LIKE $${params.length}
        OR UPPER(COALESCE(setor, '')) LIKE $${params.length}
      )`);
    }

    if (input.role) {
      params.push(input.role);
      where.push(`role = $${params.length}`);
    }

    if (input.active !== null && input.active !== undefined) {
      params.push(input.active);
      where.push(`active = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (input.page - 1) * input.itemsPerPage;

    const [countRows, rows] = await Promise.all([
      this.dataSource.query(`SELECT COUNT(*)::int AS total FROM fabrica.telas_usuarios ${whereClause}`, params),
      this.dataSource.query(
        `
          SELECT *
          FROM fabrica.telas_usuarios
          ${whereClause}
          ORDER BY matricula ASC
          LIMIT $${params.length + 1}
          OFFSET $${params.length + 2}
        `,
        [...params, input.itemsPerPage, offset],
      ),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    return {
      users: rows.map((row: AppUserOrmEntity) => mapUser(row)),
      total,
      page: input.page,
      itemsPerPage: input.itemsPerPage,
      totalPages: total > 0 ? Math.ceil(total / input.itemsPerPage) : 0,
    };
  }

  async create(input: CreateUserInput): Promise<AppUser> {
    if (!input.matricula) {
      throw new AppError(400, "MATRICULA_OBRIGATORIA", "Informe uma matrícula válida");
    }

    const role = normalizeUserRole(input.role) ?? USER_ROLES.USUARIO_PRODUCAO;
    const now = new Date(toBahiaSqlDateTime());
    const repository = this.dataSource.getRepository(AppUserOrmEntity);
    const existing = await repository.findOne({ where: { matricula: String(input.matricula) } });
    if (existing) {
      throw new AppError(409, "USUARIO_DUPLICADO", "Usuário já cadastrado para esta matrícula");
    }

    const entity = repository.create({
      matricula: String(input.matricula),
      nome: normalizeText(input.nome),
      usuario: normalizeText(input.usuario),
      setor: normalizeText(input.setor),
      unidade: normalizeText(input.unidade),
      role,
      active: input.active ?? true,
      created_at: now,
      updated_at: now,
    });

    return mapUser(await repository.save(entity));
  }

  async update(id: string, input: UpdateUserInput): Promise<AppUser> {
    const repository = this.dataSource.getRepository(AppUserOrmEntity);
    const entity = await repository.findOne({ where: { id } });
    if (!entity) {
      throw new AppError(404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado");
    }

    const role = input.role !== undefined ? normalizeUserRole(input.role) : entity.role;
    if (!role) {
      throw new AppError(400, "PAPEL_INVALIDO", "Papel de usuário inválido");
    }

    if (input.matricula !== undefined && !input.matricula) {
      throw new AppError(400, "MATRICULA_OBRIGATORIA", "Informe uma matrícula válida");
    }

    entity.matricula = input.matricula !== undefined ? String(input.matricula) : entity.matricula;
    entity.nome = input.nome !== undefined ? normalizeText(input.nome) : entity.nome;
    entity.usuario = input.usuario !== undefined ? normalizeText(input.usuario) : entity.usuario;
    entity.setor = input.setor !== undefined ? normalizeText(input.setor) : entity.setor;
    entity.unidade = input.unidade !== undefined ? normalizeText(input.unidade) : entity.unidade;
    entity.role = role;
    entity.active = input.active !== undefined ? Boolean(input.active) : entity.active;
    entity.updated_at = new Date(toBahiaSqlDateTime());

    try {
      return mapUser(await repository.save(entity));
    } catch (error) {
      throw new AppError(409, "USUARIO_DUPLICADO", "Matrícula já vinculada a outro usuário", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async delete(id: string, actorMatricula: number): Promise<AppUser> {
    const repository = this.dataSource.getRepository(AppUserOrmEntity);
    const entity = await repository.findOne({ where: { id } });
    if (!entity) {
      throw new AppError(404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado");
    }

    if (Number(entity.matricula) === actorMatricula) {
      throw new AppError(409, "AUTOEXCLUSAO_NAO_PERMITIDA", "Não é permitido excluir o próprio usuário");
    }

    if (entity.role === USER_ROLES.ADMIN && entity.active) {
      const activeAdmins = await repository.count({
        where: { role: USER_ROLES.ADMIN, active: true },
      });
      if (activeAdmins <= 1) {
        throw new AppError(409, "ULTIMO_ADMIN", "Não é permitido excluir o último administrador ativo");
      }
    }

    const user = mapUser(entity);
    await repository.remove(entity);
    return user;
  }
}
