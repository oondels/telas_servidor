import { TelaEnderecoTipo } from "../../domain/tela-endereco.js";

export interface CreateTelaEnderecoInput {
  tipo?: TelaEnderecoTipo | string;
  address?: string;
  nome?: string;
  numero?: number | string;
  vagas: number;
}

export interface UpdateTelaEnderecoVagasInput {
  vagas: number;
}
