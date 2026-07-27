import { describe, expect, it, vi } from "vitest";
import { CreateTelaUseCase } from "./create-tela.use-case.js";
import { EditTelaUseCase } from "./edit-tela.use-case.js";

describe("automatic screen status", () => {
  it("rejects a manually supplied status during creation", async () => {
    const repository = { create: vi.fn() };
    const useCase = new CreateTelaUseCase(repository as never);

    expect(() => useCase.execute({ status: "PRODUCAO" } as never, "OPERADOR"))
      .toThrowError(expect.objectContaining({ code: "STATUS_GERENCIADO_AUTOMATICAMENTE" }));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects status or address changes through general editing", async () => {
    const repository = { editByBarcode: vi.fn() };
    const useCase = new EditTelaUseCase(repository as never);

    await expect(useCase.execute("TL-001", { status: "ARMAZENADA" }, "OPERADOR"))
      .rejects.toMatchObject({ code: "LOCALIZACAO_GERENCIADA_AUTOMATICAMENTE" });
    await expect(useCase.execute("TL-001", { endereco: "01-01-01" }, "OPERADOR"))
      .rejects.toMatchObject({ code: "LOCALIZACAO_GERENCIADA_AUTOMATICAMENTE" });
    expect(repository.editByBarcode).not.toHaveBeenCalled();
  });
});
