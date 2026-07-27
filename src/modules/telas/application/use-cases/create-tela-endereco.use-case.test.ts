import { describe, expect, it, vi } from "vitest";
import { CreateTelaEnderecoUseCase } from "./create-tela-endereco.use-case.js";

describe("CreateTelaEnderecoUseCase", () => {
  it("creates a new address without changing its valid format", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ id: 238, address: "04-17-04", vagas: 23 }),
    };
    const useCase = new CreateTelaEnderecoUseCase(repository as never);

    await expect(useCase.execute({ address: "04-17-04", vagas: 23 }, "OPERADOR"))
      .resolves.toMatchObject({ address: "04-17-04", vagas: 23 });

    expect(repository.create).toHaveBeenCalledWith({ address: "04-17-04", vagas: 23 }, "OPERADOR");
  });

  it("normalizes numeric address blocks to two digits", async () => {
    const repository = { create: vi.fn().mockResolvedValue({ address: "01-02-01" }) };
    const useCase = new CreateTelaEnderecoUseCase(repository as never);

    await useCase.execute({ address: "1-2-1", vagas: 5 }, "OPERADOR");

    expect(repository.create).toHaveBeenCalledWith({ address: "01-02-01", vagas: 5 }, "OPERADOR");
  });

  it("rejects invalid addresses and capacities before persistence", async () => {
    const repository = { create: vi.fn() };
    const useCase = new CreateTelaEnderecoUseCase(repository as never);

    await expect(useCase.execute({ address: "04/17/04", vagas: 23 }, "OPERADOR"))
      .rejects.toMatchObject({ code: "FORMATO_INVALIDO" });
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
