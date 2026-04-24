import { Solicitacao } from "../../domain/solicitacao.js";
import {
  AttendSolicitacaoInput,
  CompleteSolicitacaoInput,
  CreateSolicitacaoInput,
  DeliverSolicitacaoInput,
  ReturnSolicitacaoInput,
  SearchSolicitacoesInput,
  SolicitationItemRaw,
  StartSolicitacaoInput,
} from "../dtos/solicitacao.dto.js";

export interface SearchSolicitacoesOutput {
  solicitacoes: Solicitacao[];
  total: number;
  page: number;
  itemsPerPage: number;
  totalPages: number;
}

export interface NormalizedTelaFromSolicitacao {
  marca: string;
  modelo: string;
  numerotela: string;
  cor: string;
  fios: string;
  pecas: string[];
  status: string;
}

export interface ISolicitacoesRepository {
  search(input: SearchSolicitacoesInput): Promise<SearchSolicitacoesOutput>;
  findById(id: string): Promise<Solicitacao | null>;
  create(input: CreateSolicitacaoInput, normalizedItems: SolicitationItemRaw[]): Promise<Solicitacao>;
  attend(input: AttendSolicitacaoInput): Promise<Solicitacao>;
  start(input: StartSolicitacaoInput, telasParaCadastro: NormalizedTelaFromSolicitacao[]): Promise<Solicitacao>;
  complete(input: CompleteSolicitacaoInput): Promise<Solicitacao>;
  deliver(input: DeliverSolicitacaoInput): Promise<Solicitacao>;
  return(input: ReturnSolicitacaoInput): Promise<Solicitacao>;
}
