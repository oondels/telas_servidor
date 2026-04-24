import { ISolicitacoesRepository } from "../contracts/solicitacoes.repository.js";
import { SearchSolicitacoesInput } from "../dtos/solicitacao.dto.js";

export class SearchSolicitacoesUseCase {
  constructor(private readonly solicitacoesRepository: ISolicitacoesRepository) {}

  execute(input: SearchSolicitacoesInput) {
    return this.solicitacoesRepository.search(input);
  }
}
