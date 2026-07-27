import { describe, expect, it, vi } from "vitest";
import { CreateTelaEnderecoUseCase } from "./create-tela-endereco.use-case.js";

const inventoryPayload = {
  type: "INVENTARIO",
  address: "04-17-04",
  metadata: { rua: "04", bloco: "17", nivel: "04" },
  vagas: 23,
};

describe("CreateTelaEnderecoUseCase", () => {
  it("creates a legacy inventory address using the typed contract", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ id: 238, ...inventoryPayload }),
    };
    const useCase = new CreateTelaEnderecoUseCase(repository as never);

    await expect(useCase.execute({ address: "04-17-04", vagas: 23 }, "OPERADOR"))
      .resolves.toMatchObject({ address: "04-17-04", vagas: 23 });

    expect(repository.create).toHaveBeenCalledWith(inventoryPayload, "OPERADOR");
  });

  it("normalizes numeric inventory blocks to two digits", async () => {
    const repository = { create: vi.fn().mockResolvedValue({ address: "01-02-01" }) };
    const useCase = new CreateTelaEnderecoUseCase(repository as never);

    await useCase.execute({ address: "1-2-1", vagas: 5 }, "OPERADOR");

    expect(repository.create).toHaveBeenCalledWith({
      type: "INVENTARIO",
      address: "01-02-01",
      metadata: { rua: "01", bloco: "02", nivel: "01" },
      vagas: 5,
    }, "OPERADOR");
  });

  it("creates a production address with a custom identifier", async () => {
    const repository = { create: vi.fn().mockResolvedValue({ address: "SERIGRAFIA-03" }) };
    const useCase = new CreateTelaEnderecoUseCase(repository as never);

    await useCase.execute({
      type: "PRODUCAO",
      data: { campo: "serigrafia", numero: 3 },
      vagas: 10,
    }, "OPERADOR");

    expect(repository.create).toHaveBeenCalledWith({
      type: "PRODUCAO",
      address: "SERIGRAFIA-03",
      metadata: { campo: "SERIGRAFIA", numero: 3 },
      vagas: 10,
    }, "OPERADOR");
  });

  it("rejects invalid addresses and capacities before persistence", async () => {
    const repository = { create: vi.fn() };
    const useCase = new CreateTelaEnderecoUseCase(repository as never);

    await expect(useCase.execute({ address: "04/17/04", vagas: 23 }, "OPERADOR"))
      .rejects.toMatchObject({ code: "CAMPO_ENDERECO_INVALIDO" });
    await expect(useCase.execute({ address: "04-17-04", vagas: 0 }, "OPERADOR"))
      .rejects.toMatchObject({ code: "VAGAS_INVALIDAS" });

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
