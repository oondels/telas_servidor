import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ISolicitacoesRepository } from "../contracts/solicitacoes.repository.js";

export class GetSolicitacaoByIdUseCase {
  constructor(private readonly solicitacoesRepository: ISolicitacoesRepository) {}

  async execute(id: string) {
    const solicitacao = await this.solicitacoesRepository.findById(id);
    if (!solicitacao) {
      throw new AppError(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada");
    }

    return solicitacao;
  }
}
