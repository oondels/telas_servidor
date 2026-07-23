import { describe, expect, it, vi } from "vitest";
import { BatchEnderecarTelasUseCase } from "./batch-enderecar-telas.use-case.js";

describe("BatchEnderecarTelasUseCase", () => {
  it("normalizes barcodes and delegates the atomic allocation", async () => {
    const repository = { allocateTelas: vi.fn().mockResolvedValue(2) };
    const useCase = new BatchEnderecarTelasUseCase(repository as never);

    await expect(useCase.execute({
      barcodeEndereco: "01-01-01",
      codigosTelas: [" tl-001 ", "tl-002"],
      usuario: "ADMIN",
    })).resolves.toEqual({ atualizadas: 2 });

    expect(repository.allocateTelas).toHaveBeenCalledWith("01-01-01", ["TL-001", "TL-002"], "ADMIN");
  });

  it("rejects repeated barcodes before reserving vacancies", async () => {
    const repository = { allocateTelas: vi.fn() };
    const useCase = new BatchEnderecarTelasUseCase(repository as never);

    await expect(useCase.execute({
      barcodeEndereco: "01-01-01",
      codigosTelas: ["TL-001", " tl-001 "],
      usuario: "ADMIN",
    })).rejects.toMatchObject({ code: "TELAS_REPETIDAS" });

    expect(repository.allocateTelas).not.toHaveBeenCalled();
  });

  it("rejects blank barcodes before reserving vacancies", async () => {
    const repository = { allocateTelas: vi.fn() };
    const useCase = new BatchEnderecarTelasUseCase(repository as never);

    await expect(useCase.execute({
      barcodeEndereco: "01-01-01",
      codigosTelas: ["TL-001", "  "],
      usuario: "ADMIN",
    })).rejects.toMatchObject({ code: "CODIGO_BARRAS_OBRIGATORIO" });

    expect(repository.allocateTelas).not.toHaveBeenCalled();
  });
});
