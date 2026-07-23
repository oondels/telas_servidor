import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ITelasRepository } from "../contracts/telas.repository.js";
import { CreateTelasBatchInput } from "../dtos/tela.dto.js";

const MIN_TELAS_POR_LOTE = 2;
const MAX_TELAS_POR_LOTE = 10;

export class CreateTelasBatchUseCase {
  constructor(private readonly telasRepository: ITelasRepository) {}

  async execute(input: CreateTelasBatchInput, usuarioCreate: string) {
    if (!usuarioCreate) {
      throw new AppError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
    }

    const telas = Array.isArray(input?.telas) ? input.telas : [];
    if (telas.length < MIN_TELAS_POR_LOTE || telas.length > MAX_TELAS_POR_LOTE) {
      throw new AppError(
        400,
        "QUANTIDADE_LOTE_INVALIDA",
        `Informe entre ${MIN_TELAS_POR_LOTE} e ${MAX_TELAS_POR_LOTE} telas para o cadastro em lote`,
      );
    }

    const codigos = telas.map((tela) => String(tela?.codbarrastela ?? "").trim().toUpperCase());
    if (codigos.some((codigo) => !codigo)) {
      throw new AppError(400, "CODIGO_BARRAS_OBRIGATORIO", "Informe o código de barras de cada tela do lote");
    }

    if (new Set(codigos).size !== codigos.length) {
      throw new AppError(400, "CODIGOS_BARRAS_REPETIDOS", "Os códigos de barras do lote devem ser diferentes");
    }

    return this.telasRepository.createMany(
      telas.map((tela) => ({
        data: tela,
        usuarioCreate,
        autoGenerateBarcode: false,
      })),
    );
  }
}
