import { AppError } from "../../../shared/domain/errors/app-error.js";
import { TELA_STATUS } from "./tela-status.js";

export const TELA_ENDERECO_TYPES = {
  INVENTARIO: "INVENTARIO",
  PRODUCAO: "PRODUCAO",
} as const;

export type TelaEnderecoType = typeof TELA_ENDERECO_TYPES[keyof typeof TELA_ENDERECO_TYPES];

export type TelaEnderecoMetadata = Record<string, string | number | boolean | null>;

export interface NormalizedTelaEnderecoInput {
  type: TelaEnderecoType;
  address: string;
  metadata: TelaEnderecoMetadata;
}

export const TELA_ENDERECO_TYPE_DEFINITIONS = {
  [TELA_ENDERECO_TYPES.INVENTARIO]: {
    code: TELA_ENDERECO_TYPES.INVENTARIO,
    name: "Inventário de Telas",
    statusOnEntry: TELA_STATUS.ARMAZENADA,
  },
  [TELA_ENDERECO_TYPES.PRODUCAO]: {
    code: TELA_ENDERECO_TYPES.PRODUCAO,
    name: "Produção",
    statusOnEntry: TELA_STATUS.PRODUCAO,
  },
} as const;

export const normalizeTelaEnderecoType = (value: unknown): TelaEnderecoType => {
  const normalized = String(value || TELA_ENDERECO_TYPES.INVENTARIO).trim().toUpperCase();

  if (normalized === TELA_ENDERECO_TYPES.INVENTARIO || normalized === TELA_ENDERECO_TYPES.PRODUCAO) {
    return normalized;
  }

  throw new AppError(400, "TIPO_ENDERECO_INVALIDO", `Tipo de endereço inválido: ${normalized || "NÃO INFORMADO"}.`);
};

const normalizeBlock = (value: unknown, field: string) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{1,10}$/.test(normalized)) {
    throw new AppError(400, "CAMPO_ENDERECO_INVALIDO", `${field} deve possuir entre 1 e 10 caracteres alfanuméricos.`);
  }
  return /^\d+$/.test(normalized) ? normalized.padStart(2, "0") : normalized;
};

const normalizeProductionLabel = (value: unknown) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,10}$/.test(normalized)) {
    throw new AppError(
      400,
      "IDENTIFICADOR_PRODUCAO_INVALIDO",
      "O identificador da produção deve possuir até 10 caracteres e aceitar apenas letras, números, hífen ou sublinhado.",
    );
  }
  return normalized;
};

const normalizePositiveNumber = (value: unknown, field: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, "NUMERO_ENDERECO_INVALIDO", `${field} deve ser um número inteiro maior que zero.`);
  }
  return parsed;
};

export const normalizeTelaEnderecoInput = (input: {
  type?: unknown;
  address?: unknown;
  data?: Record<string, unknown> | null;
}): NormalizedTelaEnderecoInput => {
  const type = normalizeTelaEnderecoType(input.type);
  const data = input.data ?? {};

  if (type === TELA_ENDERECO_TYPES.INVENTARIO) {
    const legacyAddress = String(input.address ?? "").trim();
    const legacyParts = legacyAddress ? legacyAddress.split("-") : [];
    const rua = normalizeBlock(data.rua ?? legacyParts[0], "Rua");
    const bloco = normalizeBlock(data.bloco ?? legacyParts[1], "Bloco");
    const nivel = normalizeBlock(data.nivel ?? legacyParts[2], "Nível");

    return {
      type,
      address: `${rua}-${bloco}-${nivel}`,
      metadata: { rua, bloco, nivel },
    };
  }

  const campo = normalizeProductionLabel(data.campo ?? data.identificador);
  const numero = normalizePositiveNumber(data.numero, "Número");

  return {
    type,
    address: `${campo}-${String(numero).padStart(2, "0")}`,
    metadata: { campo, numero },
  };
};

export const getTelaStatusForEnderecoType = (type: TelaEnderecoType) => {
  return TELA_ENDERECO_TYPE_DEFINITIONS[type].statusOnEntry;
};
