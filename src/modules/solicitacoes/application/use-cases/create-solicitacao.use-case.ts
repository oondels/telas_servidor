import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { normalizePecas } from "../../../../shared/utils/pecas.js";
import { ISolicitacoesRepository } from "../contracts/solicitacoes.repository.js";
import { CreateSolicitacaoInput, SolicitationItemRaw } from "../dtos/solicitacao.dto.js";

const normalizeSolicitacaoItem = (rawItem: SolicitationItemRaw, tipo: string) => {
  const item = rawItem && typeof rawItem === "object" ? rawItem : {};

  const normalized = {
    id: item.id ? String(item.id).trim() : undefined,
    modelo: String(item.modelo ?? "").trim().toUpperCase(),
    marca: String(item.marca ?? "").trim().toUpperCase(),
    cor: String(item.cor ?? "").trim().toUpperCase(),
    fios: String(item.fios ?? "").trim().toUpperCase(),
    pecas: normalizePecas(item.pecas ?? item.peca ?? item["peça(s)"]),
    tamanhoDoQuadro: String(item.tamanhoDoQuadro ?? item.tamanho_quadro ?? "").trim().toUpperCase(),
    numero: String(item.numero ?? item.numerotela ?? "").trim().toUpperCase(),
  };

  if (tipo === "EXISTENTE") {
    return { id: normalized.id };
  }

  if (tipo === "REPOSICAO") {
    return { ...normalized };
  }

  // NOVA (padrao)
  return {
    modelo: normalized.modelo,
    marca: normalized.marca,
    cor: normalized.cor,
    fios: normalized.fios,
    pecas: normalized.pecas,
    tamanhoDoQuadro: normalized.tamanhoDoQuadro,
    numero: normalized.numero,
  };
};

const isSolicitacaoItemValid = (item: ReturnType<typeof normalizeSolicitacaoItem>, tipo: string) => {
  if (tipo === "EXISTENTE" || tipo === "REPOSICAO") {
    // Para existente e reposição, o ID da tela original é obrigatório
    // (Para reposição, os dados novos são opcionais)
    if (!item.id) return false;
    if (tipo === "EXISTENTE") return true;
  }

  const isValidDetails = Boolean(
    item.modelo
      && item.marca
      && item.cor
      && item.fios
      && item.tamanhoDoQuadro
      && item.numero
      && item.pecas?.length,
  );

  if (tipo === "REPOSICAO") {
    // Se enviou algum detalhe, deve estar completo. Se não enviou nada, é válido apenas com o ID
    const hasAnyDetail = Boolean(
      item.modelo || item.marca || item.cor || item.fios || item.tamanhoDoQuadro || item.numero || item.pecas?.length
    );
    return hasAnyDetail ? isValidDetails : true;
  }

  return isValidDetails;
};

export class CreateSolicitacaoUseCase {
  constructor(private readonly solicitacoesRepository: ISolicitacoesRepository) {}

  async execute(input: CreateSolicitacaoInput) {
    const tipo = String(input.tipo ?? "NOVA").trim().toUpperCase();
    if (!["NOVA", "EXISTENTE", "REPOSICAO"].includes(tipo)) {
      throw new AppError(400, "TIPO_INVALIDO", "Tipo de solicitação inválido. Utilize NOVA, EXISTENTE ou REPOSICAO.");
    }

    if (tipo === "REPOSICAO" && !String(input.motivo || "").trim()) {
      throw new AppError(400, "MOTIVO_REPOSICAO_OBRIGATORIO", "O motivo da reposição é obrigatório.");
    }

    const normalizedItems = input.items.map((item) => normalizeSolicitacaoItem(item, tipo));
    if (!normalizedItems.length || normalizedItems.some((item) => !isSolicitacaoItemValid(item, tipo))) {
      throw new AppError(
        400,
        "DADOS_PEDIDO_INVALIDOS",
        "Informe ao menos um item válido para a solicitação de acordo com o tipo escolhido.",
      );
    }

    const payload = { ...input, tipo };
    return this.solicitacoesRepository.create(payload, normalizedItems);
  }
}

