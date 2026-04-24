export interface Solicitacao {
  id: string;
  solicitante: number;
  dados_pedido: Record<string, unknown>;
  motivo: string | null;
  observacao_pedido: string | null;
  turno_pedido: string | null;
  data_pedido: Date | null;
  status: string;
  entregue: boolean;
  data_entrega: Date | null;
  user_recebimento: number | null;
  user_conferente: number | null;
  observacao_conferente: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  updated_by: number | null;
}
