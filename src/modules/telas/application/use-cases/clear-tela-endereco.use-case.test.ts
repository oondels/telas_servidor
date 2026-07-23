import { describe, expect, it, vi } from "vitest";
import { ClearTelaEnderecoUseCase } from "./clear-tela-endereco.use-case.js";

describe("ClearTelaEnderecoUseCase", () => {
  it("clears every screen allocated at the selected address", async () => {
    const repository = { clearAddress: vi.fn().mockResolvedValue({ address: "01-01-01", telasLiberadas: 3 }) };
    const useCase = new ClearTelaEnderecoUseCase(repository as never);

    await expect(useCase.execute(10, "OPERADOR")).resolves.toEqual({ address: "01-01-01", telasLiberadas: 3 });
    expect(repository.clearAddress).toHaveBeenCalledWith(10, "OPERADOR");
  });

  it("rejects an invalid address id", async () => {
    const repository = { clearAddress: vi.fn() };
    const useCase = new ClearTelaEnderecoUseCase(repository as never);

    await expect(useCase.execute(0, "OPERADOR")).rejects.toMatchObject({ code: "ENDERECO_INVALIDO" });
    expect(repository.clearAddress).not.toHaveBeenCalled();
  });
});
