import { describe, expect, it, vi } from "vitest";
import { CreateTelasBatchUseCase } from "./create-telas-batch.use-case.js";

const createTela = (codigo: string) => ({
  codbarrastela: codigo,
  marca: "DASS",
  modelo: "MODELO",
  numerotela: "10",
  datafabricacao: "2026-07-23",
});

describe("CreateTelasBatchUseCase", () => {
  it("creates independent telas in a single repository batch", async () => {
    const repository = {
      createMany: vi.fn().mockResolvedValue([{ codbarrastela: "TL-001" }, { codbarrastela: "TL-002" }]),
    };
    const useCase = new CreateTelasBatchUseCase(repository as never);

    const result = await useCase.execute({ telas: [createTela("TL-001"), createTela("TL-002")] }, "OPERADOR");

    expect(result).toHaveLength(2);
    expect(repository.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ usuarioCreate: "OPERADOR", data: expect.objectContaining({ codbarrastela: "TL-001" }) }),
      expect.objectContaining({ usuarioCreate: "OPERADOR", data: expect.objectContaining({ codbarrastela: "TL-002" }) }),
    ]);
  });

  it("rejects repeated barcodes before persisting the batch", async () => {
    const repository = { createMany: vi.fn() };
    const useCase = new CreateTelasBatchUseCase(repository as never);

    await expect(useCase.execute({ telas: [createTela("TL-001"), createTela("TL-001")] }, "OPERADOR"))
      .rejects.toMatchObject({ code: "CODIGOS_BARRAS_REPETIDOS" });

    expect(repository.createMany).not.toHaveBeenCalled();
  });
});
