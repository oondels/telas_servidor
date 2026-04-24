import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { splitSlashValues } from "../../../../shared/utils/parsers.js";
import { normalizeTelaStatus } from "../../domain/tela-status.js";
import { ITelasRepository } from "../contracts/telas.repository.js";

export class UpdateStatusTelasUseCase {
  constructor(private readonly telasRepository: ITelasRepository) {}

  async execute(telasRaw: unknown, statusRaw: unknown, usuario: string) {
    if (!usuario) {
      throw new AppError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
    }

    const telas = splitSlashValues(telasRaw).map((item) => item.toUpperCase());
    if (!telas.length) {
      throw new AppError(400, "TELAS_OBRIGATORIAS", "Informe pelo menos uma tela para atualizar status");
    }

    const status = normalizeTelaStatus(statusRaw);
    const atualizadas = await this.telasRepository.updateStatusBatch({
      telas,
      status,
      usuario,
    });

    return { atualizadas, status };
  }
}
