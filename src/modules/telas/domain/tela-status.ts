export const TELA_STATUS = {
  PRODUCAO: "PRODUCAO",
  TERMINADA: "TERMINADA",
  ARMAZENADA: "ARMAZENADA",
  ESTRAGADA: "ESTRAGADA",
  SEM_ENDERECO: "SEM_ENDERECO",
  SOLICITADA: "SOLICITADA",
  EM_MOVIMENTACAO: "EM_MOVIMENTACAO",
  RETIRADA: "RETIRADA",
  EM_REPOSICAO: "EM_REPOSICAO",
  DESABILITADA: "DESABILITADA",
} as const;

export const TELA_STATUS_ALLOWED = new Set<string>(Object.values(TELA_STATUS));

export const TELA_STATUS_MANUAL_DISABLED = new Set<string>([
  TELA_STATUS.TERMINADA,
  TELA_STATUS.ESTRAGADA,
]);

export const normalizeTelaStatus = (status: unknown): string => {
  const normalized = String(status || TELA_STATUS.PRODUCAO).trim().toUpperCase();
  return TELA_STATUS_ALLOWED.has(normalized) ? normalized : TELA_STATUS.PRODUCAO;
};
