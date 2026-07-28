import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ITelasEnderecosRepository } from "../contracts/telas-enderecos.repository.js";
import { CreateTelaEnderecoInput } from "../dtos/tela-endereco.dto.js";
import { TELA_ENDERECO_TIPO, TelaEndereco } from "../../domain/tela-endereco.js";
import { DEFAULT_ADDRESS_MAX_CAPACITY } from "../../../config/domain/app-config.js";

export const PRODUCTION_ADDRESS_NAMES = [
  "CARROSSEL",
  "SAOROQUE",
  "CARROSSEL-OVAL",
  "MINI-CARROSSEL",
  "LINHA",
] as const;

const productionAddressNames = new Set<string>(PRODUCTION_ADDRESS_NAMES);

export class CreateTelaEnderecoUseCase {
  constructor(private readonly repository: ITelasEnderecosRepository) {}

  async execute(
    input: CreateTelaEnderecoInput,
    user: string,
    maxCapacity = DEFAULT_ADDRESS_MAX_CAPACITY,
  ): Promise<TelaEndereco> {
    if (!user) {
      throw new AppError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado.");
    }

    const vagas = Number(input.vagas);
    const tipo = String(input.tipo || TELA_ENDERECO_TIPO.INVENTARIO).trim().toUpperCase();

    if (!Number.isInteger(vagas) || vagas <= 0) {
      throw new AppError(400, "VAGAS_INVALIDAS", "A quantidade de vagas deve ser um número inteiro maior que 0.");
    }
    if (vagas > maxCapacity) {
      throw new AppError(
        400,
        "CAPACIDADE_ENDERECO_EXCEDIDA",
        `A capacidade do endereço não pode ultrapassar ${maxCapacity} vagas.`,
      );
    }

    if (tipo === TELA_ENDERECO_TIPO.PRODUCAO) {
      const nome = String(input.nome || "").trim().toUpperCase();
      const numero = Number(input.numero);

      if (!productionAddressNames.has(nome)) {
        throw new AppError(
          400,
          "NOME_PRODUCAO_INVALIDO",
          `O prefixo do endereço de produção deve ser um destes: ${PRODUCTION_ADDRESS_NAMES.join(", ")}.`,
        );
      }
      if (!Number.isInteger(numero) || numero <= 0) {
        throw new AppError(400, "NUMERO_PRODUCAO_INVALIDO", "Informe um número inteiro maior que zero para o endereço de produção.");
      }

      const address = `${nome}-${String(numero).padStart(2, "0")}`;
      return this.repository.create({ tipo, address, nome, numero, vagas }, user);
    }

    if (tipo !== TELA_ENDERECO_TIPO.INVENTARIO) {
      throw new AppError(400, "TIPO_ENDERECO_INVALIDO", "O tipo do endereço deve ser INVENTARIO ou PRODUCAO.");
    }

    let address = String(input.address || "").trim();

    // Normalize numeric blocks to double digits (e.g. "1-2-1" -> "01-02-01")
    const match = address.match(/^(\d+)-(\d+)-(\d+)$/);
    if (match) {
      const rua = match[1].padStart(2, "0");
      const bloco = match[2].padStart(2, "0");
      const nivel = match[3].padStart(2, "0");
      address = `${rua}-${bloco}-${nivel}`;
    }

    // Basic format validation
    const formatRegex = /^[A-Za-z0-9]+-[A-Za-z0-9]+-[A-Za-z0-9]+$/;
    if (!formatRegex.test(address)) {
      throw new AppError(
        400,
        "FORMATO_INVALIDO",
        "O endereço deve estar no formato Rua-Bloco-Nível separado por hífens (ex: 01-01-01)."
      );
    }

    return this.repository.create({
      tipo: TELA_ENDERECO_TIPO.INVENTARIO,
      address,
      nome: undefined,
      numero: undefined,
      vagas,
    }, user);
  }
}
