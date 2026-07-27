export const TELA_ENDERECO_TIPO = {
  INVENTARIO: "INVENTARIO",
  PRODUCAO: "PRODUCAO",
} as const;

export type TelaEnderecoTipo = typeof TELA_ENDERECO_TIPO[keyof typeof TELA_ENDERECO_TIPO];

export interface TelaEndereco {
  id: number;
  address: string;
  vagas: number;
  tipo: TelaEnderecoTipo;
  nome: string | null;
  numero: number | null;
  barcode: string;
  usercreate: string;
  user_edit: string | null;
  created_ad: Date;
  edited_at: Date | null;
  ocupadas?: number; // Optional statistics field populated by repository
}
