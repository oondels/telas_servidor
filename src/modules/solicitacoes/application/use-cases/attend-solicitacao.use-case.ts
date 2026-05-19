import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ISolicitacoesRepository } from "../contracts/solicitacoes.repository.js";

export class AttendSolicitacaoUseCase {
  constructor(private readonly solicitacoesRepository: ISolicitacoesRepository) {}

  execute(id: string, decision: string, updatedBy: number, observacaoConferente?: string | null) {
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
