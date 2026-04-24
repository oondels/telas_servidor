import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ensureAllowedMatricula } from "../../../../shared/auth/auth-context.js";
import { MATRICULAS_GESTORES } from "../../../shared/domain/constants/access.js";
import { NormalizedTelaFromSolicitacao, ISolicitacoesRepository } from "../contracts/solicitacoes.repository.js";

const normalizeSolicitacaoItems = (dadosPedidoRaw: Record<string, unknown>) => {
  return Array.isArray(dadosPedidoRaw?.items) ? dadosPedidoRaw.items : [];
};

const normalizeSolicitacaoPecas = (rawPecas: unknown) => {
  if (Array.isArray(rawPecas)) {
    return rawPecas
      .map((item) => String(item || "").trim().toUpperCase())
      .filter(Boolean);
  }

  if (typeof rawPecas === "string" && rawPecas.trim()) {
    return rawPecas
      .split("/")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
  }

  return [];
};

const normalizeTelaFromSolicitacaoItem = (item: Record<string, unknown>): NormalizedTelaFromSolicitacao => {
  const marca = String(item.marca ?? "").trim().toUpperCase();
  const modelo = String(item.modelo ?? "").trim().toUpperCase();
  const numero = String(item.numero ?? item.numerotela ?? item.tamanhoDoQuadro ?? "").trim().toUpperCase();
  const cor = String(item.cor ?? "").trim();
  const fios = String(item.fios ?? "").trim();
  const pecas = normalizeSolicitacaoPecas(item.pecas);

  return {
    marca,
    modelo,
    numerotela: numero,
    cor,
    fios,
    pecas,
    status: "producao",
  };
};

export class StartSolicitacaoUseCase {
  constructor(private readonly solicitacoesRepository: ISolicitacoesRepository) {}

  async execute(id: string, targetStatus: string, updatedBy: number, usuarioCreate: string) {
    ensureAllowedMatricula(
      updatedBy,
      MATRICULAS_GESTORES,
      "GESTOR_NAO_AUTORIZADO",
      "Matrícula não autorizada a gerenciar solicitações de telas",
    );

    const solicitacao = await this.solicitacoesRepository.findById(id);
    if (!solicitacao) {
      throw new AppError(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada");
    }

    const normalizedTargetStatus = String(targetStatus ?? "").trim().toLowerCase();
    const items = normalizeSolicitacaoItems(solicitacao.dados_pedido);
    const telasParaCadastro = normalizedTargetStatus === "gravacao"
      ? items.map((item) => normalizeTelaFromSolicitacaoItem(item as Record<string, unknown>))
      : [];

    if (normalizedTargetStatus === "gravacao") {
      const invalidItems = telasParaCadastro
        .map((item, index) => {
          const missingFields: string[] = [];
          if (!item.marca) missingFields.push("marca");
          if (!item.modelo) missingFields.push("modelo");
          if (!item.numerotela) missingFields.push("numero_ou_tamanhoDoQuadro");
          if (!item.cor) missingFields.push("cor");
          if (!item.fios) missingFields.push("fios");
          if (!item.pecas.length) missingFields.push("pecas");

          return missingFields.length ? { itemIndex: index + 1, missingFields } : null;
        })
        .filter(Boolean);

      if (invalidItems.length) {
        throw new AppError(
          422,
          "DADOS_PEDIDO_INCOMPLETOS",
          "Há itens sem dados suficientes para cadastrar telas",
          { invalidItems },
        );
      }
    }

    return this.solicitacoesRepository.start({
      id,
      targetStatus,
      updatedBy,
      usuarioCreate,
    }, telasParaCadastro);
  }
}
