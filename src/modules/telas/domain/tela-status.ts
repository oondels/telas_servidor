export const TELA_STATUS = {
  PRODUCAO: "PRODUCAO",
  SEM_ENDERECO: "SEM_ENDERECO",
  TERMINADA: "TERMINADA",
  ARMAZENADA: "ARMAZENADA",
  ESTRAGADA: "ESTRAGADA",
  SOLICITADA: "SOLICITADA",
  EM_MOVIMENTACAO: "EM_MOVIMENTACAO",
  RETIRADA: "RETIRADA",
  EM_REPOSICAO: "EM_REPOSICAO",
  DESABILITADA: "DESABILITADA",
} as const;

export const TELA_STATUS_ALLOWED = new Set<string>(Object.values(TELA_STATUS));

export const normalizeTelaStatus = (status: unknown): string => {
  const normalized = String(status || TELA_STATUS.SEM_ENDERECO).trim().toUpperCase();
  return TELA_STATUS_ALLOWED.has(normalized) ? normalized : TELA_STATUS.SEM_ENDERECO;
};
