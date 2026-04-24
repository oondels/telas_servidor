import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ensureAllowedMatricula } from "../../../../shared/auth/auth-context.js";
import { MATRICULAS_GESTORES } from "../../../shared/domain/constants/access.js";
import { ISolicitacoesRepository } from "../contracts/solicitacoes.repository.js";

export class DeliverSolicitacaoUseCase {
  constructor(private readonly solicitacoesRepository: ISolicitacoesRepository) {}

  execute(id: string, updatedBy: number, userRecebimento: number, userConferente: number) {
    ensureAllowedMatricula(
      updatedBy,
      MATRICULAS_GESTORES,
      "GESTOR_NAO_AUTORIZADO",
      "Matrícula não autorizada a gerenciar solicitações de telas",
    );

    if (!userRecebimento || !userConferente) {
      throw new AppError(
        400,
        "DADOS_ENTREGA_INVALIDOS",
        "Informe user_recebimento e user_conferente válidos",
      );
    }

    if (userConferente !== updatedBy) {
      throw new AppError(
        403,
        "CONFERENTE_INVALIDO",
        "user_conferente deve ser a matrícula do usuário autenticado",
      );
    }

    return this.solicitacoesRepository.deliver({
      id,
      updatedBy,
      userRecebimento,
      userConferente,
    });
  }
}
