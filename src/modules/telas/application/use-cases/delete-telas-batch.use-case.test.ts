import { describe, expect, it, vi } from "vitest";
import { DeleteTelasBatchUseCase } from "./delete-telas-batch.use-case.js";

describe("DeleteTelasBatchUseCase", () => {
  it("normalizes and deletes selected screens", async () => {
    const repository = { deleteBatch: vi.fn().mockResolvedValue(2) };
    const useCase = new DeleteTelasBatchUseCase(repository as never);

    await expect(useCase.execute("TL-001/TL-002/TL-001", "MOVIMENTADOR"))
      .resolves.toEqual({ excluidas: 2 });
    expect(repository.deleteBatch).toHaveBeenCalledWith(["TL-001", "TL-002"], "MOVIMENTADOR");
  });

  it("rejects an empty selection", async () => {
    const repository = { deleteBatch: vi.fn() };
    const useCase = new DeleteTelasBatchUseCase(repository as never);

    await expect(useCase.execute([], "MOVIMENTADOR"))
      .rejects.toMatchObject({ code: "TELAS_INSUFICIENTES" });
    expect(repository.deleteBatch).not.toHaveBeenCalled();
  });
});
