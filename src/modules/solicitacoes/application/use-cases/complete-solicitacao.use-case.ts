import { ISolicitacoesRepository } from "../contracts/solicitacoes.repository.js";

export class CompleteSolicitacaoUseCase {
  constructor(private readonly solicitacoesRepository: ISolicitacoesRepository) {}

  execute(id: string, updatedBy: number) {
    return this.solicitacoesRepository.complete({ id, updatedBy });
  }
}
