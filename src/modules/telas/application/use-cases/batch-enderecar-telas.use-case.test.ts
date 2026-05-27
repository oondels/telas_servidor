import { describe, expect, it, vi } from "vitest";
import { BatchEnderecarTelasUseCase } from "./batch-enderecar-telas.use-case.js";

describe("BatchEnderecarTelasUseCase", () => {
  it("successfully moves screens when vacancies are available", async () => {
    const addressesRepo = {
      findByBarcode: vi.fn().mockResolvedValue({
        id: 1,
        address: "01-01-01",
        vagas: 5,
        barcode: "01-01-01",
      }),
      countOccupiedVagas: vi.fn().mockResolvedValue(2),
    };
    const telasRepo = {
      findByBarcode: vi.fn().mockResolvedValue({
        id: 10,
        codbarrastela: "TL-001",
        endereco: "02-02-02", // Different address
      }),
      updatePositionBatch: vi.fn().mockResolvedValue(2),
    };

    const useCase = new BatchEnderecarTelasUseCase(addressesRepo as any, telasRepo as any);
    const result = await useCase.execute({
      barcodeEndereco: "01-01-01",
      codigosTelas: ["TL-001", "TL-002"],
      usuario: "ADMIN",
    });

    expect(result).toEqual({ atualizadas: 2 });
    expect(telasRepo.updatePositionBatch).toHaveBeenCalledOnce();
  });

  it("rejects movement when vacancies are insufficient", async () => {
    const addressesRepo = {
      findByBarcode: vi.fn().mockResolvedValue({
        id: 1,
        address: "01-01-01",
        vagas: 2,
        barcode: "01-01-01",
      }),
      countOccupiedVagas: vi.fn().mockResolvedValue(1), // 1 occupied, so 1 free
    };
    const telasRepo = {
      findByBarcode: vi.fn().mockResolvedValue({
        id: 10,
        codbarrastela: "TL-001",
        endereco: "02-02-02", // Different address, will occupy vacancy
      }),
      updatePositionBatch: vi.fn(),
    };

    const useCase = new BatchEnderecarTelasUseCase(addressesRepo as any, telasRepo as any);

    // Trying to move 2 screens when only 1 vacancy is free should reject
    await expect(
      useCase.execute({
        barcodeEndereco: "01-01-01",
        codigosTelas: ["TL-001", "TL-002"],
        usuario: "ADMIN",
      })
    ).rejects.toMatchObject({ code: "VAGAS_INSUFICIENTES" });

    expect(telasRepo.updatePositionBatch).not.toHaveBeenCalled();
  });

  it("does not count screens already at the address as consuming new space", async () => {
    const addressesRepo = {
      findByBarcode: vi.fn().mockResolvedValue({
        id: 1,
        address: "01-01-01",
        vagas: 2,
        barcode: "01-01-01",
      }),
      countOccupiedVagas: vi.fn().mockResolvedValue(1), // 1 occupied (which is the screen itself)
    };
    const telasRepo = {
      findByBarcode: vi.fn().mockResolvedValue({
        id: 10,
        codbarrastela: "TL-001",
        endereco: "01-01-01", // Already at address!
      }),
      updatePositionBatch: vi.fn().mockResolvedValue(1),
    };

    const useCase = new BatchEnderecarTelasUseCase(addressesRepo as any, telasRepo as any);

    // Moving a screen already there shouldn't reject even if available vacancies = 1 and we send 1 screen
    const result = await useCase.execute({
      barcodeEndereco: "01-01-01",
      codigosTelas: ["TL-001"],
      usuario: "ADMIN",
    });

    expect(result).toEqual({ atualizadas: 1 });
  });
});
