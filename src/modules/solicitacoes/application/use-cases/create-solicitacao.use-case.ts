import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { normalizePecas } from "../../../../shared/utils/pecas.js";
import { MATRICULAS_SOLICITANTES } from "../../../shared/domain/constants/access.js";
import { ensureAllowedMatricula } from "../../../../shared/auth/auth-context.js";
import { ISolicitacoesRepository } from "../contracts/solicitacoes.repository.js";
import { CreateSolicitacaoInput, SolicitationItemRaw } from "../dtos/solicitacao.dto.js";

const normalizeSolicitacaoItem = (rawItem: SolicitationItemRaw) => {
  const item = rawItem && typeof rawItem === "object" ? rawItem : {};

  return {
    modelo: String(item.modelo ?? "").trim().toUpperCase(),
    marca: String(item.marca ?? "").trim().toUpperCase(),
    cor: String(item.cor ?? "").trim().toUpperCase(),
    fios: String(item.fios ?? "").trim().toUpperCase(),
    pecas: normalizePecas(item.pecas ?? item.peca ?? item["peça(s)"]),
    tamanhoDoQuadro: String(item.tamanhoDoQuadro ?? item.tamanho_quadro ?? "").trim().toUpperCase(),
    numero: String(item.numero ?? item.numerotela ?? "").trim().toUpperCase(),
  };
};

const isSolicitacaoItemValid = (item: ReturnType<typeof normalizeSolicitacaoItem>) => {
  return Boolean(
    item.modelo
      && item.marca
      && item.cor
      && item.fios
      && item.tamanhoDoQuadro
      && item.numero
      && item.pecas.length,
  );
};

export class CreateSolicitacaoUseCase {
  constructor(private readonly solicitacoesRepository: ISolicitacoesRepository) {}

  async execute(input: CreateSolicitacaoInput) {
    ensureAllowedMatricula(
      input.solicitante,
      MATRICULAS_SOLICITANTES,
      "SOLICITANTE_NAO_AUTORIZADO",
      "Matrícula não autorizada a criar solicitações de telas",
    );

    const normalizedItems = input.items.map((item) => normalizeSolicitacaoItem(item));
    if (!normalizedItems.length || normalizedItems.some((item) => !isSolicitacaoItemValid(item))) {
      throw new AppError(
        400,
        "DADOS_PEDIDO_INVALIDOS",
        "Informe ao menos um item válido para a solicitação",
      );
    }

    return this.solicitacoesRepository.create(input, normalizedItems);
  }
}
