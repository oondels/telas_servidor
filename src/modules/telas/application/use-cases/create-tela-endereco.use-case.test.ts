import { describe, expect, it, vi } from "vitest";
import {
  CreateTelaEnderecoUseCase,
  PRODUCTION_ADDRESS_NAMES,
} from "./create-tela-endereco.use-case.js";

describe("CreateTelaEnderecoUseCase", () => {
  it("creates a new address without changing its valid format", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ id: 238, address: "04-17-04", vagas: 23 }),
    };
    const useCase = new CreateTelaEnderecoUseCase(repository as never);

    await expect(useCase.execute({ address: "04-17-04", vagas: 23 }, "OPERADOR"))
      .resolves.toMatchObject({ address: "04-17-04", vagas: 23 });

    expect(repository.create).toHaveBeenCalledWith({
      tipo: "INVENTARIO",
      address: "04-17-04",
      nome: undefined,
      numero: undefined,
      vagas: 23,
    }, "OPERADOR");
  });

  it("normalizes numeric address blocks to two digits", async () => {
    const repository = { create: vi.fn().mockResolvedValue({ address: "01-02-01" }) };
    const useCase = new CreateTelaEnderecoUseCase(repository as never);

    await useCase.execute({ address: "1-2-1", vagas: 5 }, "OPERADOR");

    expect(repository.create).toHaveBeenCalledWith({
      tipo: "INVENTARIO",
      address: "01-02-01",
      nome: undefined,
      numero: undefined,
      vagas: 5,
    }, "OPERADOR");
  });

  it.each(PRODUCTION_ADDRESS_NAMES)("creates a %s production address with a normalized number", async (nome) => {
    const repository = { create: vi.fn().mockResolvedValue({ address: `${nome}-01` }) };
    const useCase = new CreateTelaEnderecoUseCase(repository as never);

    await useCase.execute({ tipo: "PRODUCAO", nome, numero: 1, vagas: 8 }, "OPERADOR");

    expect(repository.create).toHaveBeenCalledWith({
      tipo: "PRODUCAO",
      address: `${nome}-01`,
      nome,
      numero: 1,
      vagas: 8,
    }, "OPERADOR");
  });

  it("rejects invalid addresses and capacities before persistence", async () => {
    const repository = { create: vi.fn() };
    const useCase = new CreateTelaEnderecoUseCase(repository as never);

    await expect(useCase.execute({ address: "04/17/04", vagas: 23 }, "OPERADOR"))
      .rejects.toMatchObject({ code: "FORMATO_INVALIDO" });
    await expect(useCase.execute({ address: "04-17-04", vagas: 0 }, "OPERADOR"))
      .rejects.toMatchObject({ code: "VAGAS_INVALIDAS" });
    await expect(useCase.execute({ tipo: "PRODUCAO", nome: "CARROSSEL", numero: 0, vagas: 10 }, "OPERADOR"))
      .rejects.toMatchObject({ code: "NUMERO_PRODUCAO_INVALIDO" });
    await expect(useCase.execute({ tipo: "PRODUCAO", nome: "PROD", numero: 1, vagas: 10 }, "OPERADOR"))
      .rejects.toMatchObject({ code: "NOME_PRODUCAO_INVALIDO" });
    await expect(useCase.execute({ address: "04-17-04", vagas: 101 }, "OPERADOR", 100))
      .rejects.toMatchObject({ code: "CAPACIDADE_ENDERECO_EXCEDIDA" });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("propagates a duplicate address conflict from persistence", async () => {
    const repository = {
      create: vi.fn().mockRejectedValue({ statusCode: 409, code: "ENDERECO_DUPLICADO" }),
    };
    const useCase = new CreateTelaEnderecoUseCase(repository as never);

    await expect(useCase.execute({ address: "04-17-04", vagas: 23 }, "OPERADOR"))
      .rejects.toMatchObject({ statusCode: 409, code: "ENDERECO_DUPLICADO" });
  });
});
