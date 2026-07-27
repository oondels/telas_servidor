import { TelaEnderecoMetadata, TelaEnderecoType } from "../../domain/tela-endereco-type.js";

export interface CreateTelaEnderecoInput {
  type?: TelaEnderecoType | string;
  address?: string;
  data?: Record<string, unknown>;
  metadata?: TelaEnderecoMetadata;
  vagas: number;
}

export interface UpdateTelaEnderecoVagasInput {
  vagas: number;
}
