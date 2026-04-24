export interface SearchTelasInput {
  letra?: string;
  modelo?: string;
  status?: string;
  endereco?: string;
  search?: string;
  page: number;
  itemsPerPage: number;
}

export interface CreateTelaInput {
  codbarrastela?: string;
  marca: string;
  modelo: string;
  numerotela?: string;
  numero?: string;
  cor?: number | null;
  fios?: number | null;
  datafabricacao?: string | null;
  dataFabricacao?: string | null;
  pecas?: unknown;
  components?: unknown;
  tamanhoEtiqueta?: string | null;
  tamanho_etiqueta?: string | null;
  status?: string | null;
}

export interface EditTelaInput extends Partial<CreateTelaInput> {
  endereco?: string | null;
}

export interface BatchUpdatePosicaoInput {
  telas: string[];
  enderecos: string[];
  usuario: string;
}

export interface BatchUpdateStatusInput {
  telas: string[];
  status: string;
  usuario: string;
}

export interface CreateTelaCommand {
  data: CreateTelaInput;
  usuarioCreate: string;
  autoGenerateBarcode?: boolean;
  fallbackDataFabricacao?: string | null;
}

export interface PaginatedTelasOutput<T> {
  telas: T[];
  total: number;
  page: number;
  itemsPerPage: number;
  totalPages: number;
}
