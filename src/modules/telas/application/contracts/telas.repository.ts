import {
  BatchUpdatePosicaoInput,
  BatchUpdateStatusInput,
  CreateTelaCommand,
  EditTelaInput,
  PaginatedTelasOutput,
  SearchTelasInput,
} from "../dtos/tela.dto.js";
import { Tela } from "../../domain/tela.js";

export interface ITelasRepository {
  search(input: SearchTelasInput): Promise<PaginatedTelasOutput<Tela>>;
  create(command: CreateTelaCommand): Promise<Tela>;
  updatePositionBatch(input: BatchUpdatePosicaoInput): Promise<number>;
  updateStatusBatch(input: BatchUpdateStatusInput): Promise<number>;
  editByBarcode(codbarrastela: string, data: EditTelaInput, usuario: string): Promise<Tela | null>;
}
