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

    const protectedData = data as EditTelaInput & Record<string, unknown>;
    const protectedFields = ["status", "endereco", "enderecoId", "endereco_id"];
    const receivedProtectedFields = protectedFields.filter((field) => Object.prototype.hasOwnProperty.call(protectedData, field));

    if (receivedProtectedFields.length) {
      throw new AppError(
        409,
        "CAMPOS_CONTROLADOS_POR_ENDERECO",
        "Status e endereço não podem ser alterados pela edição geral da tela. Utilize o fluxo de endereçamento.",
        { fields: receivedProtectedFields },
      );
    }

    const tela = await this.telasRepository.editByBarcode(codbarrastela, data, usuario);
    if (!tela) {
      throw new AppError(404, "TELA_NAO_ENCONTRADA", "Tela não encontrada para atualização");
    }

    return tela;
  }
}
