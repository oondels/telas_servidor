import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { MATRICULAS_GESTORES } from "../../../shared/domain/constants/access.js";
import { ensureAllowedMatricula } from "../../../../shared/auth/auth-context.js";
import { ISolicitacoesRepository } from "../contracts/solicitacoes.repository.js";

export class AttendSolicitacaoUseCase {
  constructor(private readonly solicitacoesRepository: ISolicitacoesRepository) {}

  execute(id: string, decision: string, updatedBy: number, observacaoConferente?: string | null) {
    ensureAllowedMatricula(
      updatedBy,
      MATRICULAS_GESTORES,
      "GESTOR_NAO_AUTORIZADO",
      "Matrícula não autorizada a gerenciar solicitações de telas",
    );

    const normalizedDecision = String(decision ?? "").trim().toLowerCase();
    if (normalizedDecision === "reprovado" && !observacaoConferente) {
      throw new AppError(400, "OBSERVACAO_OBRIGATORIA", "Informe uma observação para recusar ou cancelar");
    }

    return this.solicitacoesRepository.attend({
      id,
      decision,
      updatedBy,
      observacaoConferente,
    });
  }
}
