import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ITelasRepository } from "../contracts/telas.repository.js";

export class RemoveTelaEnderecoUseCase {
  constructor(private readonly telasRepository: ITelasRepository) {}

  async execute(codbarrastela: string, usuario: string) {
    const codigo = String(codbarrastela ?? "").trim().toUpperCase();

    if (!codigo) {
      throw new AppError(400, "CODIGO_BARRAS_OBRIGATORIO", "Código de barras da tela não informado");
    }

    const tela = await this.telasRepository.removeAddressByBarcode(codigo, usuario);
    if (!tela) {
      throw new AppError(404, "TELA_NAO_ENCONTRADA", "Tela não encontrada para remover do endereço");
    }

    return tela;
  }
}
