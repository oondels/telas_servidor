export interface SearchSolicitacoesInput {
  status?: string | null;
  solicitante?: number | null;
  search?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page: number;
  itemsPerPage: number;
}

export interface SolicitacaoItemInput {
  modelo: string;
  marca: string;
  cor: string;
  fios: string;
  pecas: string[];
  tamanhoDoQuadro: string;
  numero: string;
}

export interface CreateSolicitacaoInput {
  solicitante: number;
  items: SolicitationItemRaw[];
  motivo?: string | null;
  observacaoPedido?: string | null;
  turnoPedido?: string | null;
}

export interface SolicitationItemRaw extends Record<string, unknown> {}

export interface AttendSolicitacaoInput {
  id: string;
  decision: string;
  updatedBy: number;
  observacaoConferente?: string | null;
}

export interface StartSolicitacaoInput {
  id: string;
  targetStatus: string;
  updatedBy: number;
  usuarioCreate: string;
}

export interface CompleteSolicitacaoInput {
  id: string;
  updatedBy: number;
}

export interface DeliverSolicitacaoInput {
  id: string;
  updatedBy: number;
  userRecebimento: number;
  userConferente: number;
}

export interface ReturnSolicitacaoInput {
  id: string;
  updatedBy: number;
  userRecebimento: number;
  userConferente: number;
  observacaoConferente: string;
}
