import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { normalizePecas } from "../../../../shared/utils/pecas.js";
import { ISolicitacoesRepository } from "../contracts/solicitacoes.repository.js";
import { CreateSolicitacaoInput, SolicitationItemRaw } from "../dtos/solicitacao.dto.js";
import { ITelasRepository } from "../../../telas/application/contracts/telas.repository.js";
import { TypeOrmAppConfigRepository } from "../../../config/infrastructure/typeorm-app-config.repository.js";

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

  return { ...normalized };
};

const isSolicitacaoItemValid = (item: ReturnType<typeof normalizeSolicitacaoItem>) => {
  // We need at least the basic criteria to search or create
  if (item.id) return true; // If ID is provided, it's valid to link directly
  return Boolean(item.modelo && item.marca && item.numero && item.pecas?.length);
};

export class CreateSolicitacaoUseCase {
  constructor(
    private readonly solicitacoesRepository: ISolicitacoesRepository,
    private readonly telasRepository: ITelasRepository,
    private readonly configRepository: TypeOrmAppConfigRepository
  ) {}

  async execute(input: CreateSolicitacaoInput) {
    const tipo = String(input.tipo ?? "EXISTENTE").trim().toUpperCase();
    if (!["EXISTENTE", "REPOSICAO"].includes(tipo)) {
      throw new AppError(400, "TIPO_INVALIDO", "Tipo de solicitação inválido. Utilize EXISTENTE ou REPOSICAO.");
    }

    if (tipo === "REPOSICAO" && !String(input.motivo || "").trim()) {
      throw new AppError(400, "MOTIVO_REPOSICAO_OBRIGATORIO", "O motivo da reposição é obrigatório.");
    }

    const normalizedItems = input.items.map((item) => normalizeSolicitacaoItem(item, tipo));
    
    if (!normalizedItems.length) {
      throw new AppError(400, "DADOS_PEDIDO_INVALIDOS", "Informe ao menos um item válido para a solicitação.");
    }

    for (const item of normalizedItems) {
      if (!isSolicitacaoItemValid(item)) {
        throw new AppError(
          400,
          "DADOS_PEDIDO_INVALIDOS",
          "Todos os itens devem conter no mínimo Marca, Modelo, Número e Peças.",
        );
      }

      if (!item.id) {
        const matches = await this.telasRepository.findStrictMatch({
          marca: item.marca!,
          modelo: item.modelo!,
          numero: item.numero!,
          pecas: item.pecas ?? [],
          fios: item.fios || undefined,
        });

        if (matches.length === 1) {
          item.id = String(matches[0].id);
        } else if (matches.length > 1) {
          throw new AppError(409, "MULTIPLAS_TELAS_ENCONTRADAS", "Múltiplas telas correspondem aos dados informados. Por favor, selecione a tela exata.", { matches, item });
        } else {
          // matches.length === 0
          const autoCadastro = await this.configRepository.getAutoCadastroConfig();
          if (autoCadastro.enabled) {
            if (!item.fios || !item.cor) {
              throw new AppError(400, "DADOS_INCOMPLETOS_AUTO_CADASTRO", "Para o auto-cadastro, os campos 'Fios' e 'Cor' são obrigatórios.");
            }
            if (tipo === "REPOSICAO" && !item.tamanhoDoQuadro) {
               throw new AppError(400, "DADOS_INCOMPLETOS_AUTO_CADASTRO", "Para repor e auto-cadastrar, informe o tamanho do quadro.");
            }
            const fallbackData = new Date().toISOString().split("T")[0];
            const novaTela = await this.telasRepository.create({
              data: {
                marca: item.marca,
                modelo: item.modelo,
                numerotela: item.numero,
                cor: Number(item.cor),
                fios: Number(item.fios),
                pecas: item.pecas,
                tamanhoEtiqueta: item.tamanhoDoQuadro,
                status: "NOVA",
                datafabricacao: fallbackData,
              },
              usuarioCreate: String(input.solicitante),
              autoGenerateBarcode: true,
              fallbackDataFabricacao: fallbackData
            });
            item.id = String(novaTela.id);
          } else {
            throw new AppError(404, "TELA_NAO_ENCONTRADA", `Nenhuma tela encontrada para a marca ${item.marca}, modelo ${item.modelo}, número ${item.numero}.`);
          }
        }
      }
    }

    // Now everything has an ID
    const payload = { ...input, tipo };
    return this.solicitacoesRepository.create(payload, normalizedItems);
  }
}

