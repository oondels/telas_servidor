import { describe, expect, it } from "vitest";
import { normalizeTelaStatus, TELA_STATUS_ALLOWED } from "./tela-status.js";

describe("tela status", () => {
  it("accepts expanded operational statuses", () => {
    expect(TELA_STATUS_ALLOWED.has("DESABILITADA")).toBe(true);
    expect(TELA_STATUS_ALLOWED.has("EM_REPOSICAO")).toBe(true);
    expect(TELA_STATUS_ALLOWED.has("RETIRADA")).toBe(true);
  });

  it("normalizes invalid status to PRODUCAO for backward compatibility", () => {
    expect(normalizeTelaStatus("desabilitada")).toBe("DESABILITADA");
    expect(normalizeTelaStatus("inexistente")).toBe("PRODUCAO");
  });
});
