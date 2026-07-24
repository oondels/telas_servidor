import { describe, expect, it, vi } from "vitest";
import { RemoveTelasEnderecoBatchUseCase } from "./remove-telas-endereco-batch.use-case.js";

describe("RemoveTelasEnderecoBatchUseCase", () => {
  it("normalizes and removes at least two distinct screens", async () => {
    const repository = { removeAddressBatch: vi.fn().mockResolvedValue(2) };
    const useCase = new RemoveTelasEnderecoBatchUseCase(repository as never);

    await expect(useCase.execute([" tl-001 ", "TL-002", "tl-001"], "MOVIMENTADOR"))
      .resolves.toEqual({ removidas: 2 });
    expect(repository.removeAddressBatch).toHaveBeenCalledWith(["TL-001", "TL-002"], "MOVIMENTADOR");
  });

  it("rejects a single screen", async () => {
    const repository = { removeAddressBatch: vi.fn() };
    const useCase = new RemoveTelasEnderecoBatchUseCase(repository as never);

    await expect(useCase.execute(["TL-001"], "MOVIMENTADOR"))
      .rejects.toMatchObject({ code: "TELAS_INSUFICIENTES" });
    expect(repository.removeAddressBatch).not.toHaveBeenCalled();
  });
});
