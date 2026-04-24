import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ITelasRepository } from "../contracts/telas.repository.js";
import { EditTelaInput } from "../dtos/tela.dto.js";

export class EditTelaUseCase {
  constructor(private readonly telasRepository: ITelasRepository) {}

  async execute(codbarrastela: string, data: EditTelaInput, usuario: string) {
    if (!usuario) {
      throw new AppError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
    }

    if (!codbarrastela) {
      throw new AppError(400, "CODIGO_BARRAS_OBRIGATORIO", "Código de barras não fornecido para edição");
    }

    const tela = await this.telasRepository.editByBarcode(codbarrastela, data, usuario);
    if (!tela) {
      throw new AppError(404, "TELA_NAO_ENCONTRADA", "Tela não encontrada para atualização");
    }

    return tela;
  }
}
