import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ensureAllowedMatricula } from "../../../../shared/auth/auth-context.js";
import { MATRICULAS_GESTORES } from "../../../shared/domain/constants/access.js";
import { ISolicitacoesRepository } from "../contracts/solicitacoes.repository.js";

export class ReturnSolicitacaoUseCase {
  constructor(private readonly solicitacoesRepository: ISolicitacoesRepository) {}

  execute(
    id: string,
    updatedBy: number,
    userRecebimento: number,
    userConferente: number,
    observacaoConferente: string,
  ) {
    ensureAllowedMatricula(
      updatedBy,
      MATRICULAS_GESTORES,
      "GESTOR_NAO_AUTORIZADO",
      "Matrícula não autorizada a gerenciar solicitações de telas",
    );

    if (!userRecebimento || !userConferente) {
      throw new AppError(
        400,
        "DADOS_DEVOLUCAO_INVALIDOS",
        "Informe user_recebimento e user_conferente válidos",
      );
    }

    if (!observacaoConferente) {
      throw new AppError(
        400,
        "OBSERVACAO_OBRIGATORIA",
        "Informe observacao_conferente para registrar a devolução",
      );
    }

    if (userConferente !== updatedBy) {
      throw new AppError(
        403,
        "CONFERENTE_INVALIDO",
        "user_conferente deve ser a matrícula do usuário autenticado",
      );
    }

    return this.solicitacoesRepository.return({
      id,
      updatedBy,
      userRecebimento,
      userConferente,
      observacaoConferente,
    });
  }
}
