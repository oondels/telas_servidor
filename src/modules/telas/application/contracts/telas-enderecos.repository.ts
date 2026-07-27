import { TelaEndereco } from "../../domain/tela-endereco.js";
import { CreateTelaEnderecoInput } from "../dtos/tela-endereco.dto.js";

export interface TelaEnderecoTransfer {
  screenCode: string;
  from: string | null;
  to: string;
  previousStatus: string | null;
  newStatus: string;
}

export interface AllocateTelasResult {
  updatedCount: number;
  destination: TelaEndereco;
  transfers: TelaEnderecoTransfer[];
  alreadyAtDestination: string[];
}

export interface ITelasEnderecosRepository {
  create(data: CreateTelaEnderecoInput, user: string): Promise<TelaEndereco>;
  findByBarcode(barcode: string): Promise<TelaEndereco | null>;
  findByAddress(address: string): Promise<TelaEndereco | null>;
  listAll(type?: string): Promise<TelaEndereco[]>;
  countOccupiedVagas(address: string): Promise<number>;
  allocateTelas(barcodeEndereco: string, codigosTelas: string[], usuario: string): Promise<AllocateTelasResult>;
  clearAddress(id: number, usuario: string): Promise<{ address: string; telasLiberadas: number }>;
  updateVagas(id: number, vagas: number, user: string): Promise<TelaEndereco>;
  delete(id: number): Promise<void>;
}
