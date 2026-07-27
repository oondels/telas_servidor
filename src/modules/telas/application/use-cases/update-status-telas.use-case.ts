import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ITelasRepository } from "../contracts/telas.repository.js";

export class UpdateStatusTelasUseCase {
  constructor(private readonly telasRepository: ITelasRepository) {
    void this.telasRepository;
  }

  async execute(_telasRaw: unknown, _statusRaw: unknown, _usuario: string): Promise<never> {
    throw new AppError(
      410,
      "STATUS_CONTROLADO_POR_ENDERECO",
      "A alteração manual de status foi desabilitada. O status da tela agora é definido automaticamente pelo tipo de endereço.",
    );
  }
}
