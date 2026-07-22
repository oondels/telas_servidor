import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { DeleteTelaUseCase } from "./delete-tela.use-case.js";

describe("DeleteTelaUseCase", () => {
  it("deletes the screen using the normalized barcode", async () => {
    const repository = {
      deleteByBarcode: vi.fn().mockResolvedValue({ codbarrastela: "TL-001" }),
    };
    const useCase = new DeleteTelaUseCase(repository as never);

    await expect(useCase.execute(" tl-001 ", "ADMIN")).resolves.toMatchObject({ codbarrastela: "TL-001" });
    expect(repository.deleteByBarcode).toHaveBeenCalledWith("TL-001", "ADMIN");
  });

  it("preserves the active-solicitation block returned by the repository", async () => {
    const repository = {
      deleteByBarcode: vi.fn().mockRejectedValue(new AppError(409, "TELA_COM_SOLICITACAO_ATIVA", "Tela em uso")),
    };
    const useCase = new DeleteTelaUseCase(repository as never);

    await expect(useCase.execute("TL-001", "ADMIN")).rejects.toMatchObject({ code: "TELA_COM_SOLICITACAO_ATIVA" });
  });
});
