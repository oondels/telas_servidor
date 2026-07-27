import { describe, expect, it, vi } from "vitest";
import { AuditEventOrmEntity } from "../../../infrastructure/database/entities/audit-event.entity.js";
import { TelaEnderecoOrmEntity } from "../../../infrastructure/database/entities/tela-endereco.entity.js";
import { TelaOrmEntity } from "../../../infrastructure/database/entities/tela.entity.js";
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

describe("TypeOrmTelasEnderecosRepository.allocateTelas", () => {
  it("transfers a screen from its current address to the destination", async () => {
    const tela = {
      codbarrastela: "TL-001",
      endereco: "01-01-01",
      usuarioendereco: "USUARIO_ANTERIOR",
      status: "ARMAZENADA",
    };
    const addressQuery = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue({ address: "PROD-01", vagas: 2, tipo: "PRODUCAO" }),
    };
    const telaQuery = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([tela]),
    };
    const telasRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(telaQuery),
      count: vi.fn().mockResolvedValue(0),
      save: vi.fn().mockImplementation(async (entity) => entity),
    };
    const auditRepository = {
      create: vi.fn().mockImplementation((entity) => entity),
      save: vi.fn().mockImplementation(async (entity) => entity),
    };
    const manager = {
      getRepository: vi.fn((entity) => {
        if (entity === TelaEnderecoOrmEntity) return { createQueryBuilder: vi.fn().mockReturnValue(addressQuery) };
        if (entity === TelaOrmEntity) return telasRepository;
        if (entity === AuditEventOrmEntity) return auditRepository;
        throw new Error("Unexpected entity");
      }),
    };
    const dataSource = {
      transaction: vi.fn(async (callback) => callback(manager)),
    };
    const repository = new TypeOrmTelasEnderecosRepository(dataSource as never);

    await expect(repository.allocateTelas("PROD-01", ["TL-001"], "MOVIMENTADOR")).resolves.toBe(1);

    expect(telasRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      codbarrastela: "TL-001",
      endereco: "PROD-01",
      usuarioendereco: "MOVIMENTADOR",
      status: "PRODUCAO",
    }));
    expect(auditRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      action: "ENDERECO_ATUALIZADO",
      before_state: {
        endereco: "01-01-01",
        usuarioendereco: "USUARIO_ANTERIOR",
        status: "ARMAZENADA",
      },
      after_state: {
        endereco: "PROD-01",
        usuarioendereco: "MOVIMENTADOR",
        status: "PRODUCAO",
      },
    }));

    addressQuery.getOne.mockResolvedValueOnce({ address: "02-02-02", vagas: 2, tipo: "INVENTARIO" });

    await expect(repository.allocateTelas("02-02-02", ["TL-001"], "MOVIMENTADOR")).resolves.toBe(1);

    expect(telasRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({
      codbarrastela: "TL-001",
      endereco: "02-02-02",
      status: "ARMAZENADA",
    }));
    expect(auditRepository.create).toHaveBeenLastCalledWith(expect.objectContaining({
      before_state: expect.objectContaining({ endereco: "PROD-01", status: "PRODUCAO" }),
      after_state: expect.objectContaining({ endereco: "02-02-02", status: "ARMAZENADA" }),
    }));
  });
});
