import { describe, expect, it, vi } from "vitest";
import { TypeOrmTelasEnderecosRepository } from "./typeorm-telas-enderecos.repository.js";

const makeRepository = (save: ReturnType<typeof vi.fn>) => {
  const entity = {
    id: "238",
    address: "04-17-04",
    vagas: 23,
    barcode: "04-17-04",
    usercreate: "OPERADOR",
    user_edit: null,
    created_ad: new Date(),
    edited_at: null,
  };
  const ormRepository = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockReturnValue(entity),
    save,
  };
  const dataSource = {
    getRepository: vi.fn().mockReturnValue(ormRepository),
  };

  return {
    repository: new TypeOrmTelasEnderecosRepository(dataSource as never),
    ormRepository,
  };
};

describe("TypeOrmTelasEnderecosRepository.create", () => {
  it("creates a new address after existing records", async () => {
    const save = vi.fn().mockResolvedValue({
      id: "238",
      address: "04-17-04",
      vagas: 23,
      barcode: "04-17-04",
      usercreate: "OPERADOR",
      user_edit: null,
      created_ad: new Date(),
      edited_at: null,
    });
    const { repository, ormRepository } = makeRepository(save);

    await expect(repository.create({ address: "04-17-04", vagas: 23 }, "OPERADOR"))
      .resolves.toMatchObject({ id: 238, address: "04-17-04", vagas: 23 });

    expect(ormRepository.findOne).toHaveBeenCalledWith({ where: { address: "04-17-04" } });
    expect(save).toHaveBeenCalledOnce();
  });

  it("maps address uniqueness violations to a conflict", async () => {
    const save = vi.fn().mockRejectedValue({
      driverError: { code: "23505", constraint: "telas_enderecos_address_key" },
    });
    const { repository } = makeRepository(save);

    await expect(repository.create({ address: "04-17-04", vagas: 23 }, "OPERADOR"))
      .rejects.toMatchObject({ statusCode: 409, code: "ENDERECO_DUPLICADO" });
  });

  it("maps primary-key sequence collisions to a safe server error", async () => {
    const save = vi.fn().mockRejectedValue({
      driverError: { code: "23505", constraint: "telas_enderecos_pkey" },
    });
    const { repository } = makeRepository(save);

    await expect(repository.create({ address: "04-17-04", vagas: 23 }, "OPERADOR"))
      .rejects.toMatchObject({ statusCode: 500, code: "SEQUENCIA_ENDERECO_INVALIDA" });
  });

  it("maps missing required database columns to a client error", async () => {
    const save = vi.fn().mockRejectedValue({
      driverError: { code: "23502", column: "usercreate" },
    });
    const { repository } = makeRepository(save);

    await expect(repository.create({ address: "04-17-04", vagas: 23 }, "OPERADOR"))
      .rejects.toMatchObject({ statusCode: 400, code: "DADOS_ENDERECO_INCOMPLETOS" });
  });
});
