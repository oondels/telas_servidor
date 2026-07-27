import { describe, expect, it } from "vitest";
import {
  getTelaStatusForEnderecoType,
  normalizeTelaEnderecoInput,
} from "./tela-endereco-type.js";

describe("tela address types", () => {
  it("normalizes inventory addresses", () => {
    expect(normalizeTelaEnderecoInput({
      type: "INVENTARIO",
      data: { rua: 1, bloco: 2, nivel: 3 },
    })).toEqual({
      type: "INVENTARIO",
      address: "01-02-03",
      metadata: { rua: "01", bloco: "02", nivel: "03" },
    });
  });

  it("normalizes production addresses", () => {
    expect(normalizeTelaEnderecoInput({
      type: "PRODUCAO",
      data: { campo: "linha_a", numero: 12 },
    })).toEqual({
      type: "PRODUCAO",
      address: "LINHA_A-12",
      metadata: { campo: "LINHA_A", numero: 12 },
    });
  });

  it("rejects production identifiers longer than ten characters", () => {
    expect(() => normalizeTelaEnderecoInput({
      type: "PRODUCAO",
      data: { campo: "SERIGRAFIA01", numero: 1 },
    })).toThrowError();
  });

  it("derives screen status from the destination type", () => {
    expect(getTelaStatusForEnderecoType("INVENTARIO")).toBe("ARMAZENADA");
    expect(getTelaStatusForEnderecoType("PRODUCAO")).toBe("PRODUCAO");
  });
});
