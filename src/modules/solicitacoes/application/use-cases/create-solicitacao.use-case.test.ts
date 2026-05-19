import { describe, expect, it, vi } from "vitest";
import { CreateSolicitacaoUseCase } from "./create-solicitacao.use-case.js";

describe("CreateSolicitacaoUseCase", () => {
  it("creates solicitation without hardcoded matricula allowlist", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ id: "sol-1" }),
    };
    const useCase = new CreateSolicitacaoUseCase(repository as never);

    await expect(useCase.execute({
      solicitante: 9999999,
      items: [{
        modelo: "abc",
        marca: "dass",
        cor: "1",
        fios: "43",
        pecas: ["lateral"],
        tamanhoDoQuadro: "10",
        numero: "1",
      }],
    })).resolves.toEqual({ id: "sol-1" });

    expect(repository.create).toHaveBeenCalledOnce();
  });

  it("rejects empty or incomplete item list", async () => {
    const repository = { create: vi.fn() };
    const useCase = new CreateSolicitacaoUseCase(repository as never);

    await expect(useCase.execute({
      solicitante: 3020495,
      items: [],
    })).rejects.toMatchObject({ code: "DADOS_PEDIDO_INVALIDOS" });
  });
});
