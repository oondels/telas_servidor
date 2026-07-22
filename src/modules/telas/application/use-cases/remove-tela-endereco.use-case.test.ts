import { describe, expect, it, vi } from "vitest";
import { RemoveTelaEnderecoUseCase } from "./remove-tela-endereco.use-case.js";

describe("RemoveTelaEnderecoUseCase", () => {
  it("removes the address using the normalized barcode", async () => {
    const repository = {
      removeAddressByBarcode: vi.fn().mockResolvedValue({ codbarrastela: "TL-001", endereco: null }),
    };
    const useCase = new RemoveTelaEnderecoUseCase(repository as never);

    await expect(useCase.execute(" tl-001 ", "OPERADOR")).resolves.toMatchObject({ endereco: null });
    expect(repository.removeAddressByBarcode).toHaveBeenCalledWith("TL-001", "OPERADOR");
  });

  it("rejects a missing barcode", async () => {
    const repository = { removeAddressByBarcode: vi.fn() };
    const useCase = new RemoveTelaEnderecoUseCase(repository as never);

    await expect(useCase.execute("", "OPERADOR")).rejects.toMatchObject({ code: "CODIGO_BARRAS_OBRIGATORIO" });
    expect(repository.removeAddressByBarcode).not.toHaveBeenCalled();
  });
});
