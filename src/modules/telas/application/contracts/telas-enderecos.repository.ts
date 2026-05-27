import { TelaEndereco } from "../../domain/tela-endereco.js";
import { CreateTelaEnderecoInput } from "../dtos/tela-endereco.dto.js";

export interface ITelasEnderecosRepository {
  create(data: CreateTelaEnderecoInput, user: string): Promise<TelaEndereco>;
  findByBarcode(barcode: string): Promise<TelaEndereco | null>;
  findByAddress(address: string): Promise<TelaEndereco | null>;
  listAll(): Promise<TelaEndereco[]>;
  countOccupiedVagas(address: string): Promise<number>;
  updateVagas(id: number, vagas: number, user: string): Promise<TelaEndereco>;
  delete(id: number): Promise<void>;
}
