export const SOLICITACAO_STATUS = {
  PEDIDO: "pedido",
  ACEITO: "aceito",
  REPROVADO: "reprovado",
  GRAVACAO: "gravacao",
  SETOR_EM_MANUTENCAO: "setor_em_manutencao",
  CONCLUIDO: "concluido",
  ENTREGUE: "entregue",
  DEVOLVIDO: "devolvido",
} as const;

export type SolicitacaoStatus = (typeof SOLICITACAO_STATUS)[keyof typeof SOLICITACAO_STATUS];

const allowedStatus = new Set<string>(Object.values(SOLICITACAO_STATUS));

export const normalizeSolicitacaoStatus = (rawStatus: unknown): SolicitacaoStatus | null => {
  const normalized = String(rawStatus ?? "").trim().toLowerCase();
  return allowedStatus.has(normalized) ? (normalized as SolicitacaoStatus) : null;
};

export const SOLICITACAO_TRANSITIONS: Record<SolicitacaoStatus, Set<SolicitacaoStatus>> = {
  pedido: new Set(["aceito", "reprovado"]),
  aceito: new Set(["gravacao", "setor_em_manutencao"]),
  reprovado: new Set(),
  gravacao: new Set(["concluido"]),
  setor_em_manutencao: new Set(["gravacao", "reprovado"]),
  concluido: new Set(["entregue"]),
  entregue: new Set(["devolvido"]),
  devolvido: new Set(),
};
