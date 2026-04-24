import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ITelasRepository } from "../contracts/telas.repository.js";
import { CreateTelaInput } from "../dtos/tela.dto.js";

export class CreateTelaUseCase {
  constructor(private readonly telasRepository: ITelasRepository) {}

  execute(data: CreateTelaInput, usuarioCreate: string) {
    if (!usuarioCreate) {
      throw new AppError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
    }

    return this.telasRepository.create({
      data,
      usuarioCreate,
      autoGenerateBarcode: false,
    });
  }
}
