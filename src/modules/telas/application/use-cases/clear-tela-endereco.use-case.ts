import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ITelasEnderecosRepository } from "../contracts/telas-enderecos.repository.js";

export class ClearTelaEnderecoUseCase {
  constructor(private readonly repository: ITelasEnderecosRepository) {}

  async execute(id: number, usuario: string) {
    if (!usuario) {
      throw new AppError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado.");
    }
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(400, "ENDERECO_INVALIDO", "Endereço inválido.");
    }

    return this.repository.clearAddress(id, usuario);
  }
}
