import { ensureAllowedMatricula } from "../../../../shared/auth/auth-context.js";
import { MATRICULAS_GESTORES } from "../../../shared/domain/constants/access.js";
import { ISolicitacoesRepository } from "../contracts/solicitacoes.repository.js";

export class CompleteSolicitacaoUseCase {
  constructor(private readonly solicitacoesRepository: ISolicitacoesRepository) {}

  execute(id: string, updatedBy: number) {
    ensureAllowedMatricula(
      updatedBy,
      MATRICULAS_GESTORES,
      "GESTOR_NAO_AUTORIZADO",
      "Matrícula não autorizada a gerenciar solicitações de telas",
    );

    return this.solicitacoesRepository.complete({ id, updatedBy });
  }
}
