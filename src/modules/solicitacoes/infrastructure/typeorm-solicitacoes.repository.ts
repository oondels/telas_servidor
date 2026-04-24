import { DataSource } from "typeorm";
import { TypeOrmTelasRepository } from "../../telas/infrastructure/typeorm-telas.repository.js";
import { SolicitacaoOrmEntity } from "../../../infrastructure/database/entities/solicitacao.entity.js";
import { AppError } from "../../../shared/domain/errors/app-error.js";
import { toBahiaSqlDateTime } from "../../../shared/utils/date.js";
import {
  ISolicitacoesRepository,
  NormalizedTelaFromSolicitacao,
  SearchSolicitacoesOutput,
} from "../application/contracts/solicitacoes.repository.js";
import {
  AttendSolicitacaoInput,
  CompleteSolicitacaoInput,
  CreateSolicitacaoInput,
  DeliverSolicitacaoInput,
  ReturnSolicitacaoInput,
  SearchSolicitacoesInput,
  SolicitationItemRaw,
  StartSolicitacaoInput,
} from "../application/dtos/solicitacao.dto.js";
import { Solicitacao } from "../domain/solicitacao.js";
import {
  normalizeSolicitacaoStatus,
  SOLICITACAO_STATUS,
  SolicitacaoStatus,
} from "../domain/solicitacao-status.js";

const TABLE_NAME = "fabrica.solicitacao_tela";

const mapSolicitacao = (entity: SolicitacaoOrmEntity): Solicitacao => ({
  id: entity.id,
  solicitante: Number(entity.solicitante),
  dados_pedido: entity.dados_pedido,
  motivo: entity.motivo,
  observacao_pedido: entity.observacao_pedido,
  turno_pedido: entity.turno_pedido,
  data_pedido: entity.data_pedido,
  status: entity.status ?? SOLICITACAO_STATUS.PEDIDO,
  entregue: entity.entregue,
  data_entrega: entity.data_entrega,
  user_recebimento: entity.user_recebimento !== null ? Number(entity.user_recebimento) : null,
  user_conferente: entity.user_conferente !== null ? Number(entity.user_conferente) : null,
  observacao_conferente: entity.observacao_conferente,
  created_at: entity.created_at,
  updated_at: entity.updated_at,
  updated_by: entity.updated_by !== null ? Number(entity.updated_by) : null,
});

const normalizeCurrentStatus = (rawStatus: string | null | undefined): SolicitacaoStatus => {
  return normalizeSolicitacaoStatus(rawStatus) ?? SOLICITACAO_STATUS.PEDIDO;
};

const createTransitionError = (
  currentStatus: string,
  expectedCurrentStatus: string | string[],
  nextStatus: string,
) => {
  const expected = Array.isArray(expectedCurrentStatus) ? expectedCurrentStatus : [expectedCurrentStatus];

  return new AppError(
    409,
    "TRANSICAO_STATUS_INVALIDA",
    "Transição de status não permitida",
    {
      atual: currentStatus,
      esperado: expected,
      proximo: nextStatus,
    },
  );
};

export class TypeOrmSolicitacoesRepository implements ISolicitacoesRepository {
  private readonly telasRepository: TypeOrmTelasRepository;

  constructor(private readonly dataSource: DataSource) {
    this.telasRepository = new TypeOrmTelasRepository(dataSource);
  }

  async search(input: SearchSolicitacoesInput): Promise<SearchSolicitacoesOutput> {
    const search = String(input.search ?? "").trim().toUpperCase();

    const params: unknown[] = [];
    const where: string[] = [];

    if (input.status) {
      params.push(input.status);
      where.push(`status = $${params.length}`);
    }

    if (input.solicitante) {
      params.push(input.solicitante);
      where.push(`solicitante = $${params.length}`);
    }

    if (input.dateFrom) {
      params.push(`${input.dateFrom} 00:00:00`);
      where.push(`data_pedido >= $${params.length}`);
    }

    if (input.dateTo) {
      params.push(`${input.dateTo} 23:59:59`);
      where.push(`data_pedido <= $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        UPPER(CAST(id AS TEXT)) LIKE $${params.length}
        OR CAST(solicitante AS TEXT) LIKE $${params.length}
        OR UPPER(COALESCE(motivo, '')) LIKE $${params.length}
        OR UPPER(COALESCE(observacao_pedido, '')) LIKE $${params.length}
        OR UPPER(COALESCE(turno_pedido, '')) LIKE $${params.length}
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(dados_pedido->'items', '[]'::jsonb)) AS item
          WHERE UPPER(COALESCE(item->>'modelo', '')) LIKE $${params.length}
             OR UPPER(COALESCE(item->>'marca', '')) LIKE $${params.length}
             OR UPPER(COALESCE(item->>'numero', '')) LIKE $${params.length}
             OR UPPER(COALESCE(item->>'tamanhoDoQuadro', '')) LIKE $${params.length}
        )
      )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (input.page - 1) * input.itemsPerPage;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM ${TABLE_NAME}
      ${whereClause}
    `;

    const query = `
      SELECT *
      FROM ${TABLE_NAME}
      ${whereClause}
      ORDER BY data_pedido DESC, created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const [countRows, rows] = await Promise.all([
      this.dataSource.query(countQuery, params),
      this.dataSource.query(query, [...params, input.itemsPerPage, offset]),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    return {
      solicitacoes: rows.map((row: SolicitacaoOrmEntity) => mapSolicitacao(row)),
      total,
      page: input.page,
      itemsPerPage: input.itemsPerPage,
      totalPages: total > 0 ? Math.ceil(total / input.itemsPerPage) : 0,
    };
  }

  async findById(id: string): Promise<Solicitacao | null> {
    const entity = await this.dataSource.getRepository(SolicitacaoOrmEntity).findOne({ where: { id } });
    return entity ? mapSolicitacao(entity) : null;
  }

  async create(input: CreateSolicitacaoInput, normalizedItems: SolicitationItemRaw[]): Promise<Solicitacao> {
    const repository = this.dataSource.getRepository(SolicitacaoOrmEntity);
    const now = new Date(toBahiaSqlDateTime());

    const entity = repository.create({
      solicitante: String(input.solicitante),
      dados_pedido: { items: normalizedItems },
      motivo: input.motivo ?? null,
      observacao_pedido: input.observacaoPedido ?? null,
      turno_pedido: input.turnoPedido ?? null,
      data_pedido: now,
      status: SOLICITACAO_STATUS.PEDIDO,
      entregue: false,
      created_at: now,
      updated_at: now,
      updated_by: String(input.solicitante),
    });

    const saved = await repository.save(entity);
    return mapSolicitacao(saved);
  }

  async attend(input: AttendSolicitacaoInput): Promise<Solicitacao> {
    const normalizedDecision = String(input.decision ?? "").trim().toLowerCase() === "recusado"
      ? SOLICITACAO_STATUS.REPROVADO
      : normalizeSolicitacaoStatus(input.decision);

    if (normalizedDecision !== SOLICITACAO_STATUS.ACEITO && normalizedDecision !== SOLICITACAO_STATUS.REPROVADO) {
      throw new AppError(
        400,
        "DECISAO_INVALIDA",
        "Decisão inválida para atendimento. Utilize aceito ou recusado.",
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SolicitacaoOrmEntity);
      const current = await repository.findOne({ where: { id: input.id }, lock: { mode: "pessimistic_write" } });
      if (!current) {
        throw new AppError(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada");
      }

      const currentStatus = normalizeCurrentStatus(current.status);
      const canAttendFromPedido = currentStatus === SOLICITACAO_STATUS.PEDIDO;
      const canCancelFromManutencao = currentStatus === SOLICITACAO_STATUS.SETOR_EM_MANUTENCAO
        && normalizedDecision === SOLICITACAO_STATUS.REPROVADO;

      if (!canAttendFromPedido && !canCancelFromManutencao) {
        throw createTransitionError(
          currentStatus,
          [SOLICITACAO_STATUS.PEDIDO, SOLICITACAO_STATUS.SETOR_EM_MANUTENCAO],
          normalizedDecision,
        );
      }

      current.status = normalizedDecision;
      current.observacao_conferente = input.observacaoConferente ?? current.observacao_conferente;
      if (input.observacaoConferente) {
        current.user_conferente = String(input.updatedBy);
      }
      current.updated_at = new Date(toBahiaSqlDateTime());
      current.updated_by = String(input.updatedBy);

      const saved = await repository.save(current);
      return mapSolicitacao(saved);
    });
  }

  async start(input: StartSolicitacaoInput, telasParaCadastro: NormalizedTelaFromSolicitacao[]): Promise<Solicitacao> {
    const targetStatus = normalizeSolicitacaoStatus(input.targetStatus);
    if (
      !targetStatus
      || (targetStatus !== SOLICITACAO_STATUS.GRAVACAO
        && targetStatus !== SOLICITACAO_STATUS.SETOR_EM_MANUTENCAO)
    ) {
      throw new AppError(
        400,
        "STATUS_INICIO_INVALIDO",
        "Status de início inválido. Utilize gravacao ou setor_em_manutencao.",
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SolicitacaoOrmEntity);
      const current = await repository.findOne({ where: { id: input.id }, lock: { mode: "pessimistic_write" } });
      if (!current) {
        throw new AppError(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada");
      }

      const currentStatus = normalizeCurrentStatus(current.status);
      const canStartFromAceito = currentStatus === SOLICITACAO_STATUS.ACEITO;
      const canResumeFromManutencao = currentStatus === SOLICITACAO_STATUS.SETOR_EM_MANUTENCAO
        && targetStatus === SOLICITACAO_STATUS.GRAVACAO;

      if (!canStartFromAceito && !canResumeFromManutencao) {
        throw createTransitionError(
          currentStatus,
          [SOLICITACAO_STATUS.ACEITO, SOLICITACAO_STATUS.SETOR_EM_MANUTENCAO],
          targetStatus,
        );
      }

      current.status = targetStatus;
      current.updated_at = new Date(toBahiaSqlDateTime());
      current.updated_by = String(input.updatedBy);
      const saved = await repository.save(current);

      if (targetStatus === SOLICITACAO_STATUS.GRAVACAO) {
        const dataFabricacao = new Date().toISOString().slice(0, 10);
        await this.telasRepository.createManyFromSolicitacao(
          manager,
          telasParaCadastro,
          input.usuarioCreate || String(input.updatedBy),
          dataFabricacao,
        );
      }

      return mapSolicitacao(saved);
    });
  }

  async complete(input: CompleteSolicitacaoInput): Promise<Solicitacao> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SolicitacaoOrmEntity);
      const current = await repository.findOne({ where: { id: input.id }, lock: { mode: "pessimistic_write" } });
      if (!current) {
        throw new AppError(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada");
      }

      const currentStatus = normalizeCurrentStatus(current.status);
      if (currentStatus !== SOLICITACAO_STATUS.GRAVACAO) {
        throw createTransitionError(currentStatus, SOLICITACAO_STATUS.GRAVACAO, SOLICITACAO_STATUS.CONCLUIDO);
      }

      current.status = SOLICITACAO_STATUS.CONCLUIDO;
      current.updated_at = new Date(toBahiaSqlDateTime());
      current.updated_by = String(input.updatedBy);

      const saved = await repository.save(current);
      return mapSolicitacao(saved);
    });
  }

  async deliver(input: DeliverSolicitacaoInput): Promise<Solicitacao> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SolicitacaoOrmEntity);
      const current = await repository.findOne({ where: { id: input.id }, lock: { mode: "pessimistic_write" } });
      if (!current) {
        throw new AppError(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada");
      }

      const currentStatus = normalizeCurrentStatus(current.status);
      if (currentStatus !== SOLICITACAO_STATUS.CONCLUIDO) {
        throw createTransitionError(currentStatus, SOLICITACAO_STATUS.CONCLUIDO, SOLICITACAO_STATUS.ENTREGUE);
      }

      const now = new Date(toBahiaSqlDateTime());
      current.status = SOLICITACAO_STATUS.ENTREGUE;
      current.entregue = true;
      current.data_entrega = now;
      current.user_recebimento = String(input.userRecebimento);
      current.user_conferente = String(input.userConferente);
      current.updated_at = now;
      current.updated_by = String(input.updatedBy);

      const saved = await repository.save(current);
      return mapSolicitacao(saved);
    });
  }

  async return(input: ReturnSolicitacaoInput): Promise<Solicitacao> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SolicitacaoOrmEntity);
      const current = await repository.findOne({ where: { id: input.id }, lock: { mode: "pessimistic_write" } });
      if (!current) {
        throw new AppError(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada");
      }

      const currentStatus = normalizeCurrentStatus(current.status);
      if (currentStatus !== SOLICITACAO_STATUS.ENTREGUE) {
        throw createTransitionError(currentStatus, SOLICITACAO_STATUS.ENTREGUE, SOLICITACAO_STATUS.DEVOLVIDO);
      }

      current.status = SOLICITACAO_STATUS.DEVOLVIDO;
      current.entregue = false;
      current.user_recebimento = String(input.userRecebimento);
      current.user_conferente = String(input.userConferente);
      current.observacao_conferente = input.observacaoConferente;
      current.updated_at = new Date(toBahiaSqlDateTime());
      current.updated_by = String(input.updatedBy);

      const saved = await repository.save(current);
      return mapSolicitacao(saved);
    });
  }
}
