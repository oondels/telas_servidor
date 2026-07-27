import { TelaEnderecoMetadata, TelaEnderecoType } from "./tela-endereco-type.js";

export interface TelaEndereco {
  id: number;
  address: string;
  type: TelaEnderecoType;
  metadata: TelaEnderecoMetadata;
  active: boolean;
  vagas: number;
  barcode: string;
  usercreate: string;
  user_edit: string | null;
  created_ad: Date;
  edited_at: Date | null;
  ocupadas?: number;
}
