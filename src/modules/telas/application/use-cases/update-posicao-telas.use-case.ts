import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { splitSlashValues } from "../../../../shared/utils/parsers.js";
import { ITelasRepository } from "../contracts/telas.repository.js";

export class UpdatePosicaoTelasUseCase {
  constructor(private readonly telasRepository: ITelasRepository) {}

  async execute(telasRaw: unknown, enderecoRaw: unknown, usuario: string) {
    if (!usuario) {
      throw new AppError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
    }

    const telas = splitSlashValues(telasRaw).map((item) => item.toUpperCase());
    const enderecosRaw = splitSlashValues(enderecoRaw).map((item) => item.toUpperCase());

    if (!telas.length) {
      throw new AppError(400, "TELAS_OBRIGATORIAS", "Informe pelo menos uma tela para movimentação");
    }

    if (!enderecosRaw.length) {
      throw new AppError(400, "ENDERECO_OBRIGATORIO", "Informe um endereço para movimentação");
    }

    const enderecos = enderecosRaw.length === 1 ? telas.map(() => enderecosRaw[0] ?? "") : enderecosRaw;

    if (enderecos.length !== telas.length) {
      throw new AppError(
        400,
        "MATRIZ_INVALIDA",
        "Quantidade de endereços incompatível com a quantidade de telas",
      );
    }

    const atualizadas = await this.telasRepository.updatePositionBatch({
      telas,
      enderecos,
      usuario,
    });

    return { atualizadas };
  }
}
