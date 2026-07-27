import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ITelasEnderecosRepository } from "../contracts/telas-enderecos.repository.js";
import { CreateTelaEnderecoInput } from "../dtos/tela-endereco.dto.js";
import { TelaEndereco } from "../../domain/tela-endereco.js";
import { normalizeTelaEnderecoInput } from "../../domain/tela-endereco-type.js";

export class CreateTelaEnderecoUseCase {
  constructor(private readonly repository: ITelasEnderecosRepository) {}

  async execute(input: CreateTelaEnderecoInput, user: string): Promise<TelaEndereco> {
    if (!user) {
      throw new AppError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado.");
    }

    const vagas = Number(input.vagas);
    if (!Number.isInteger(vagas) || vagas <= 0) {
      throw new AppError(400, "VAGAS_INVALIDAS", "A quantidade de vagas deve ser um número inteiro maior que 0.");
    }

    const normalized = normalizeTelaEnderecoInput({
      type: input.type,
      address: input.address,
      data: input.data,
    });

    return this.repository.create({
      type: normalized.type,
      address: normalized.address,
      metadata: normalized.metadata,
      vagas,
    }, user);
  }
}
