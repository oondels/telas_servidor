import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ITelasRepository } from "../contracts/telas.repository.js";
import { ITelasEnderecosRepository } from "../contracts/telas-enderecos.repository.js";

export interface BatchEnderecarTelasInput {
  barcodeEndereco: string;
  codigosTelas: string[];
  usuario: string;
}

export class BatchEnderecarTelasUseCase {
  constructor(
    private readonly repository: ITelasEnderecosRepository,
    private readonly telasRepository: ITelasRepository,
  ) {}

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

    // 1. Fetch address details
    const address = await this.repository.findByBarcode(barcodeEndereco);
    if (!address) {
      throw new AppError(404, "ENDERECO_NAO_ENCONTRADO", `O endereço com código de barras ${barcodeEndereco} não foi encontrado.`);
    }

    // 2. Count occupied spots
    const occupied = await this.repository.countOccupiedVagas(address.address);
    const available = address.vagas - occupied;

    // 3. Verify vacancy limits
    // If the screens being moved are already at this address, they don't consume *new* space.
    // So we should find which of the scanned screens are NOT already at this address.
    const screensNotAtAddress: string[] = [];
    const normalizedCodigosTelas: string[] = [];

    for (const barcode of codigosTelas) {
      const code = String(barcode || "").trim().toUpperCase();
      normalizedCodigosTelas.push(code);

      const existingTela = await this.telasRepository.findByBarcode(code);
      if (!existingTela) {
        throw new AppError(404, "TELA_NAO_ENCONTRADA", `A tela com código ${code} não foi encontrada.`);
      }
      if (existingTela.endereco !== address.address) {
        screensNotAtAddress.push(code);
      }
    }

    if (screensNotAtAddress.length > available) {
      throw new AppError(
        400,
        "VAGAS_INSUFICIENTES",
        `Vagas insuficientes no endereço ${address.address}. Vagas disponíveis: ${available}. Telas a alocar: ${screensNotAtAddress.length}.`
      );
    }

    // 4. Update screen positions batch
    const enderecos = normalizedCodigosTelas.map(() => address.address);
    const updatedCount = await this.telasRepository.updatePositionBatch({
      telas: normalizedCodigosTelas,
      enderecos,
      usuario,
    });

    return { atualizadas: updatedCount };
  }
}
