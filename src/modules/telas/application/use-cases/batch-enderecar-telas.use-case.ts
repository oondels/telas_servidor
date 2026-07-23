import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ITelasEnderecosRepository } from "../contracts/telas-enderecos.repository.js";

export interface BatchEnderecarTelasInput {
  barcodeEndereco: string;
  codigosTelas: string[];
  usuario: string;
}

export class BatchEnderecarTelasUseCase {
  constructor(private readonly repository: ITelasEnderecosRepository) {}

  async execute(input: BatchEnderecarTelasInput): Promise<{ atualizadas: number }> {
    const { barcodeEndereco, codigosTelas, usuario } = input;

    if (!usuario) {
      throw new AppError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado.");
    }
    if (!barcodeEndereco) {
      throw new AppError(400, "ENDERECO_OBRIGATORIO", "Informe o código de barras do endereço.");
    }
    if (!codigosTelas || !codigosTelas.length) {
      throw new AppError(400, "TELAS_OBRIGATORIAS", "Informe pelo menos uma tela para endereçamento.");
    }

    const normalizedCodigosTelas = codigosTelas.map((barcode) => String(barcode || "").trim().toUpperCase());
    if (normalizedCodigosTelas.some((codigo) => !codigo)) {
      throw new AppError(400, "CODIGO_BARRAS_OBRIGATORIO", "Informe um código de barras válido para cada tela.");
    }
    if (new Set(normalizedCodigosTelas).size !== normalizedCodigosTelas.length) {
      throw new AppError(400, "TELAS_REPETIDAS", "Uma mesma tela não pode ser endereçada mais de uma vez no lote.");
    }

    const updatedCount = await this.repository.allocateTelas(barcodeEndereco, normalizedCodigosTelas, usuario);

    return { atualizadas: updatedCount };
  }
}
