import { describe, expect, it, vi } from "vitest";
import { BatchEnderecarTelasUseCase } from "./batch-enderecar-telas.use-case.js";

describe("BatchEnderecarTelasUseCase", () => {
  it("normalizes barcodes and delegates the atomic transfer", async () => {
    const destination = {
      id: 10,
      address: "PRODUCAO-01",
      type: "PRODUCAO",
      metadata: { campo: "PRODUCAO", numero: 1 },
      active: true,
      vagas: 10,
      barcode: "PRODUCAO-01",
      usercreate: "ADMIN",
      user_edit: null,
      created_ad: new Date(),
      edited_at: null,
    };
    const transfer = {
      screenCode: "TL-001",
      from: "01-01-01",
      to: "PRODUCAO-01",
      previousStatus: "ARMAZENADA",
      newStatus: "PRODUCAO",
    };
    const repository = {
      allocateTelas: vi.fn().mockResolvedValue({
        updatedCount: 1,
        destination,
        transfers: [transfer],
        alreadyAtDestination: ["TL-002"],
      }),
    };
    const useCase = new BatchEnderecarTelasUseCase(repository as never);

    await expect(useCase.execute({
      barcodeEndereco: "PRODUCAO-01",
      codigosTelas: [" tl-001 ", "tl-002"],
      usuario: "ADMIN",
    })).resolves.toEqual({
      atualizadas: 1,
      destino: destination,
      transferencias: [transfer],
      jaNoDestino: ["TL-002"],
    });

    expect(repository.allocateTelas).toHaveBeenCalledWith("PRODUCAO-01", ["TL-001", "TL-002"], "ADMIN");
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
