import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ITelasEnderecosRepository } from "../contracts/telas-enderecos.repository.js";
import { CreateTelaEnderecoInput } from "../dtos/tela-endereco.dto.js";
import { TelaEndereco } from "../../domain/tela-endereco.js";

export class CreateTelaEnderecoUseCase {
  constructor(private readonly repository: ITelasEnderecosRepository) {}

  async execute(input: CreateTelaEnderecoInput, user: string): Promise<TelaEndereco> {
    if (!user) {
      throw new AppError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado.");
    }

    let address = String(input.address || "").trim();
    const vagas = Number(input.vagas);

    // Normalize numeric blocks to double digits (e.g. "1-2-1" -> "01-02-01")
    const match = address.match(/^(\d+)-(\d+)-(\d+)$/);
    if (match) {
      const rua = match[1].padStart(2, "0");
      const bloco = match[2].padStart(2, "0");
      const nivel = match[3].padStart(2, "0");
      address = `${rua}-${bloco}-${nivel}`;
    }

    // Basic format validation
    const formatRegex = /^[A-Za-z0-9]+-[A-Za-z0-9]+-[A-Za-z0-9]+$/;
    if (!formatRegex.test(address)) {
      throw new AppError(
        400,
        "FORMATO_INVALIDO",
        "O endereço deve estar no formato Rua-Bloco-Nível separado por hífens (ex: 01-01-01)."
      );
    }

    return this.repository.create({ address, vagas }, user);
  }
}
