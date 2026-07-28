import { describe, expect, it, vi } from "vitest";
import { USER_ROLES } from "../domain/user-role.js";
import { TypeOrmUsersRepository } from "./typeorm-users.repository.js";

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: "user-id",
  matricula: "3020001",
  nome: "USUARIO TESTE",
  usuario: "USUARIO.TESTE",
  setor: "SERIGRAFIA",
  unidade: "SEST",
  role: USER_ROLES.USUARIO_PRODUCAO,
  active: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const makeRepository = (entity: ReturnType<typeof makeUser>, activeAdmins = 2) => {
  const ormRepository = {
    findOne: vi.fn().mockResolvedValue(entity),
    count: vi.fn().mockResolvedValue(activeAdmins),
    remove: vi.fn().mockResolvedValue(entity),
  };
  const dataSource = {
    getRepository: vi.fn().mockReturnValue(ormRepository),
  };

  return {
    repository: new TypeOrmUsersRepository(dataSource as never),
    ormRepository,
  };
};

describe("TypeOrmUsersRepository.delete", () => {
  it("deletes another user", async () => {
    const entity = makeUser();
    const { repository, ormRepository } = makeRepository(entity);

    await expect(repository.delete(entity.id, 3020495))
      .resolves.toMatchObject({ id: entity.id, matricula: 3020001 });

    expect(ormRepository.remove).toHaveBeenCalledWith(entity);
  });

  it("rejects deleting the authenticated user", async () => {
    const entity = makeUser();
    const { repository, ormRepository } = makeRepository(entity);

    await expect(repository.delete(entity.id, 3020001))
      .rejects.toMatchObject({ statusCode: 409, code: "AUTOEXCLUSAO_NAO_PERMITIDA" });

    expect(ormRepository.remove).not.toHaveBeenCalled();
  });

  it("rejects deleting the last active administrator", async () => {
    const entity = makeUser({ role: USER_ROLES.ADMIN });
    const { repository, ormRepository } = makeRepository(entity, 1);

    await expect(repository.delete(entity.id, 3020495))
      .rejects.toMatchObject({ statusCode: 409, code: "ULTIMO_ADMIN" });

    expect(ormRepository.remove).not.toHaveBeenCalled();
  });
});
