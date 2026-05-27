import {
  BatchUpdatePosicaoInput,
  BatchUpdateStatusInput,
  CreateTelaCommand,
  EditTelaInput,
  PaginatedTelasOutput,
  ReplaceTelaInput,
  SearchInactiveTelasInput,
  SearchTelasInput,
} from "../dtos/tela.dto.js";
import { Tela } from "../../domain/tela.js";

export interface ITelasRepository {
  search(input: SearchTelasInput): Promise<PaginatedTelasOutput<Tela>>;
  create(command: CreateTelaCommand): Promise<Tela>;
  updatePositionBatch(input: BatchUpdatePosicaoInput): Promise<number>;
  updateStatusBatch(input: BatchUpdateStatusInput): Promise<number>;
  editByBarcode(codbarrastela: string, data: EditTelaInput, usuario: string): Promise<Tela | null>;
  replaceByBarcode(codbarrastela: string, data: ReplaceTelaInput, usuario: string): Promise<Tela | null>;
  searchInactive(input: SearchInactiveTelasInput): Promise<PaginatedTelasOutput<Tela & { lastMovementAt: Date | null; daysWithoutMovement: number | null }>>;
  findStrictMatch(input: { marca: string; modelo: string; numero: string; pecas: string[]; fios?: string }): Promise<Tela[]>;
  findByBarcode(barcode: string): Promise<Tela | null>;
}
