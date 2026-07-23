import { DataSource, EntityManager } from "typeorm";
import { TelaOrmEntity } from "../../../infrastructure/database/entities/tela.entity.js";
import { TypeOrmAuditEventsRepository } from "../../audit/infrastructure/typeorm-audit-events.repository.js";
import { AppError } from "../../../shared/domain/errors/app-error.js";
import { toBahiaSqlDateTime, normalizeDate } from "../../../shared/utils/date.js";
import { normalizePecas } from "../../../shared/utils/pecas.js";
import { parseNullableNumber } from "../../../shared/utils/parsers.js";
import { Tela } from "../domain/tela.js";
import { normalizeTelaStatus } from "../domain/tela-status.js";
import { ITelasRepository } from "../application/contracts/telas.repository.js";
import {
  BatchUpdatePosicaoInput,
  BatchUpdateStatusInput,
  CreateTelaCommand,
  EditTelaInput,
  PaginatedTelasOutput,
  ReplaceTelaInput,
  SearchInactiveTelasInput,
  SearchTelasInput,
} from "../application/dtos/tela.dto.js";

const TABLE_NAME = "fabrica.controle_telas_prateleiras";
const ACTIVE_SOLICITACAO_STATUSES = [
  "pedido",
  "aceito",
  "gravacao",
  "setor_em_manutencao",
  "concluido",
  "entregue",
];

const mapTelaEntity = (entity: TelaOrmEntity): Tela => ({
  id: Number(entity.id),
  codbarrastela: entity.codbarrastela ?? "",
  marca: entity.marca,
  modelo: entity.modelo,
  numerotela: entity.numerotela,
  cor: entity.cor,
  fios: entity.fios !== null ? Number(entity.fios) : null,
  datafabricacao: entity.datafabricacao,
  pecas: entity.pecas,
  tamanho_etiqueta: entity.tamanho_etiqueta,
  status: entity.status,
  endereco: entity.endereco,
  createdate: entity.createdate,
  updatedate: entity.updatedate,
  sku: entity.sku,
});

const resolveBarcode = (data: Partial<{ codbarrastela: string; codBarrasTela: string }>) => {
  return String(data.codbarrastela ?? data.codBarrasTela ?? "")
    .trim()
    .toUpperCase();
};

const generateBarcodeCandidate = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");

  return `TL${ts}${rnd}`.slice(0, 40);
};

export class TypeOrmTelasRepository implements ITelasRepository {
  private readonly auditRepository: TypeOrmAuditEventsRepository;

  constructor(private readonly dataSource: DataSource) {
    this.auditRepository = new TypeOrmAuditEventsRepository(dataSource);
  }

  async search(input: SearchTelasInput): Promise<PaginatedTelasOutput<Tela>> {
    const letra = String(input.letra ?? "").trim().toUpperCase();
    const modelo = String(input.modelo ?? "").trim().toUpperCase();
    const status = input.status ? normalizeTelaStatus(input.status) : "";
    const endereco = String(input.endereco ?? "").trim().toUpperCase();
    const search = String(input.search ?? "").trim().toUpperCase();

    const params: unknown[] = [];
    const where: string[] = [];

    if (letra) {
      params.push(letra);
      where.push(`UPPER(SUBSTRING(modelo, 1, 1)) = $${params.length}`);
    }

    if (modelo) {
      params.push(`${modelo}%`);
      where.push(`UPPER(modelo) LIKE $${params.length}`);
    }

    if (status) {
      params.push(status);
      where.push(`UPPER(status) = $${params.length}`);
    }

    if (endereco) {
      params.push(`${endereco}%`);
      where.push(`UPPER(COALESCE(endereco, '')) LIKE $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        UPPER(COALESCE(modelo, '')) LIKE $${params.length}
        OR UPPER(COALESCE(marca, '')) LIKE $${params.length}
        OR UPPER(COALESCE(numerotela, '')) LIKE $${params.length}
        OR UPPER(COALESCE(codbarrastela, '')) LIKE $${params.length}
        OR UPPER(COALESCE(endereco, '')) LIKE $${params.length}
        OR CAST(id AS TEXT) LIKE $${params.length}
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
      ORDER BY createdate DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const [countRows, rows] = await Promise.all([
      this.dataSource.query(countQuery, params),
      this.dataSource.query(query, [...params, input.itemsPerPage, offset]),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    return {
      telas: rows.map((row: TelaOrmEntity) => mapTelaEntity(row)),
      total,
      page: input.page,
      itemsPerPage: input.itemsPerPage,
      totalPages: total > 0 ? Math.ceil(total / input.itemsPerPage) : 0,
    };
  }

  async create(command: CreateTelaCommand): Promise<Tela> {
    return this.dataSource.transaction(async (manager) => {
      const entity = await this.insertTela(manager, command);
      const tela = mapTelaEntity(entity);
      await this.auditRepository.create({
        entityType: "TELA",
        entityId: tela.codbarrastela,
        action: "TELA_CRIADA",
        actorUsuario: command.usuarioCreate,
        afterState: tela as unknown as Record<string, unknown>,
      }, manager);
      return tela;
    });
  }

  async createMany(commands: CreateTelaCommand[]): Promise<Tela[]> {
    return this.dataSource.transaction(async (manager) => {
      const telas: Tela[] = [];

      for (const command of commands) {
        const entity = await this.insertTela(manager, command);
        const tela = mapTelaEntity(entity);
        await this.auditRepository.create({
          entityType: "TELA",
          entityId: tela.codbarrastela,
          action: "TELA_CRIADA",
          actorUsuario: command.usuarioCreate,
          afterState: tela as unknown as Record<string, unknown>,
        }, manager);
        telas.push(tela);
      }

      return telas;
    });
  }

  async updatePositionBatch(input: BatchUpdatePosicaoInput): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const updateDate = toBahiaSqlDateTime();

      for (let index = 0; index < input.telas.length; index += 1) {
        const codigoTela = input.telas[index];
        const novoEndereco = input.enderecos[index];

        const result = await manager
          .createQueryBuilder()
          .update(TelaOrmEntity)
          .set({
            updatedate: new Date(updateDate),
            usuarioendereco: input.usuario,
            endereco: novoEndereco,
            usuarioaltera: input.usuario,
          })
          .where("codbarrastela = :codigoTela", { codigoTela })
          .execute();

        if (!result.affected) {
          throw new AppError(404, "TELA_NAO_ENCONTRADA", "Uma ou mais telas não foram encontradas", {
            codigo: codigoTela,
          });
        }

        await this.auditRepository.create({
          entityType: "TELA",
          entityId: codigoTela ?? "",
          action: "ENDERECO_ATUALIZADO",
          actorUsuario: input.usuario,
          afterState: { endereco: novoEndereco },
        }, manager);
      }

      return input.telas.length;
    });
  }

  async updateStatusBatch(input: BatchUpdateStatusInput): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const updateDate = toBahiaSqlDateTime();

      for (const codigoTela of input.telas) {
        const result = await manager
          .createQueryBuilder()
          .update(TelaOrmEntity)
          .set({
            updatedate: new Date(updateDate),
            usuariostatus: input.usuario,
            status: input.status,
            usuarioaltera: input.usuario,
          })
          .where("codbarrastela = :codigoTela", { codigoTela })
          .execute();

        if (!result.affected) {
          throw new AppError(404, "TELA_NAO_ENCONTRADA", "Uma ou mais telas não foram encontradas", {
            codigo: codigoTela,
          });
        }

        await this.auditRepository.create({
          entityType: "TELA",
          entityId: codigoTela,
          action: input.status === "DESABILITADA" ? "TELA_DESABILITADA" : "STATUS_ATUALIZADO",
          actorUsuario: input.usuario,
          afterState: { status: input.status },
        }, manager);
      }

      return input.telas.length;
    });
  }

  async editByBarcode(codbarrastela: string, data: EditTelaInput, usuario: string): Promise<Tela | null> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TelaOrmEntity);
      const entity = await repository.findOne({ where: { codbarrastela } });

      if (!entity) {
        return null;
      }

      const before = mapTelaEntity(entity);
      this.applyTelaPatch(entity, data, usuario);

      const saved = await repository.save(entity);
      const after = mapTelaEntity(saved);
      await this.auditRepository.create({
        entityType: "TELA",
        entityId: codbarrastela,
        action: "TELA_EDITADA",
        actorUsuario: usuario,
        beforeState: before as unknown as Record<string, unknown>,
        afterState: after as unknown as Record<string, unknown>,
      }, manager);

      return after;
    });
  }

  async replaceByBarcode(codbarrastela: string, data: ReplaceTelaInput, usuario: string): Promise<Tela | null> {
    const motivo = String(data.motivo ?? "").trim();
    if (!motivo) {
      throw new AppError(400, "MOTIVO_REPOSICAO_OBRIGATORIO", "Informe o motivo da reposição");
    }

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TelaOrmEntity);
      const entity = await repository.findOne({ where: { codbarrastela }, lock: { mode: "pessimistic_write" } });
      if (!entity) {
        return null;
      }

      const before = mapTelaEntity(entity);
      this.applyTelaPatch(entity, { ...data, status: data.status ?? "EM_REPOSICAO" }, usuario);
      const saved = await repository.save(entity);
      const after = mapTelaEntity(saved);

      await this.auditRepository.create({
        entityType: "TELA",
        entityId: codbarrastela,
        action: "TELA_REPOSTA",
        actorUsuario: usuario,
        beforeState: before as unknown as Record<string, unknown>,
        afterState: after as unknown as Record<string, unknown>,
        metadata: { motivo },
      }, manager);

      return after;
    });
  }

  async removeAddressByBarcode(codbarrastela: string, usuario: string): Promise<Tela | null> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TelaOrmEntity);
      const entity = await repository.findOne({
        where: { codbarrastela },
        lock: { mode: "pessimistic_write" },
      });

      if (!entity) {
        return null;
      }

      const before = mapTelaEntity(entity);
      entity.endereco = null;
      entity.usuarioendereco = usuario;
      entity.usuarioaltera = usuario;
      entity.updatedate = new Date(toBahiaSqlDateTime());

      const saved = await repository.save(entity);
      const after = mapTelaEntity(saved);
      await this.auditRepository.create({
        entityType: "TELA",
        entityId: codbarrastela,
        action: "ENDERECO_REMOVIDO",
        actorUsuario: usuario,
        beforeState: before as unknown as Record<string, unknown>,
        afterState: after as unknown as Record<string, unknown>,
      }, manager);

      return after;
    });
  }

  async deleteByBarcode(codbarrastela: string, usuario: string): Promise<Tela | null> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TelaOrmEntity);
      const entity = await repository.findOne({
        where: { codbarrastela },
        lock: { mode: "pessimistic_write" },
      });

      if (!entity) {
        return null;
      }

      const activeSolicitacaoRows = await manager.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM fabrica.solicitacao_tela solicitacao
            WHERE COALESCE(solicitacao.status::text, 'pedido') = ANY($2::text[])
              AND EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(solicitacao.dados_pedido->'items', '[]'::jsonb)) AS item
                WHERE item->>'id' = $1
              )
          ) AS exists
        `,
        [String(entity.id), ACTIVE_SOLICITACAO_STATUSES],
      );

      if (activeSolicitacaoRows[0]?.exists) {
        throw new AppError(
          409,
          "TELA_COM_SOLICITACAO_ATIVA",
          "Não é possível excluir uma tela vinculada a uma solicitação ativa",
          { telaId: entity.id, codbarrastela },
        );
      }

      const before = mapTelaEntity(entity);
      await this.auditRepository.create({
        entityType: "TELA",
        entityId: codbarrastela,
        action: "TELA_EXCLUIDA",
        actorUsuario: usuario,
        beforeState: before as unknown as Record<string, unknown>,
        metadata: { exclusaoPermanente: true },
      }, manager);
      await repository.remove(entity);

      return before;
    });
  }

  async searchInactive(input: SearchInactiveTelasInput) {
    const offset = (input.page - 1) * input.itemsPerPage;
    const params = [input.days, input.itemsPerPage, offset];
    const baseQuery = `
      WITH last_events AS (
        SELECT entity_id, MAX(created_at) AS last_event_at
        FROM fabrica.telas_audit_events
        WHERE entity_type = 'TELA'
        GROUP BY entity_id
      ),
      telas_base AS (
        SELECT
          telas.*,
          COALESCE(last_events.last_event_at, telas.updatedate, telas.createdate) AS last_movement_at
        FROM ${TABLE_NAME} telas
        LEFT JOIN last_events ON last_events.entity_id = telas.codbarrastela
        WHERE UPPER(COALESCE(telas.status, '')) <> 'DESABILITADA'
          AND COALESCE(last_events.last_event_at, telas.updatedate, telas.createdate) <= NOW() - ($1::int * INTERVAL '1 day')
      )
    `;

    const [countRows, rows] = await Promise.all([
      this.dataSource.query(`${baseQuery} SELECT COUNT(*)::int AS total FROM telas_base`, [input.days]),
      this.dataSource.query(
        `
          ${baseQuery}
          SELECT *, FLOOR(EXTRACT(EPOCH FROM (NOW() - last_movement_at)) / 86400)::int AS days_without_movement
          FROM telas_base
          ORDER BY last_movement_at ASC NULLS FIRST
          LIMIT $2
          OFFSET $3
        `,
        params,
      ),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    return {
      telas: rows.map((row: TelaOrmEntity & { last_movement_at: Date | null; days_without_movement: number | null }) => ({
        ...mapTelaEntity(row),
        lastMovementAt: row.last_movement_at,
        daysWithoutMovement: row.days_without_movement,
      })),
      total,
      page: input.page,
      itemsPerPage: input.itemsPerPage,
      totalPages: total > 0 ? Math.ceil(total / input.itemsPerPage) : 0,
    };
  }

  async createManyFromSolicitacao(
    manager: EntityManager,
    items: Array<{
      marca: string;
      modelo: string;
      numerotela: string;
      cor: string;
      fios: string;
      pecas: string[];
      status: string;
    }>,
    usuarioCreate: string,
    fallbackDataFabricacao: string,
  ) {
    for (const item of items) {
      await this.insertTela(manager, {
        data: {
          marca: item.marca,
          modelo: item.modelo,
          numerotela: item.numerotela,
          cor: item.cor,
          fios: Number(item.fios),
          datafabricacao: fallbackDataFabricacao,
          pecas: item.pecas,
          status: item.status,
        },
        usuarioCreate,
        autoGenerateBarcode: true,
        fallbackDataFabricacao,
      });
    }
  }

  async findStrictMatch(input: { marca: string; modelo: string; numero: string; pecas: string[]; fios?: string }): Promise<Tela[]> {
    const repository = this.dataSource.getRepository(TelaOrmEntity);
    
    // As pecas sao salvas como JSON.stringify(Array), entao buscaremos usando JSON e os demais campos exatos.
    const query = repository.createQueryBuilder("tela")
      .where("UPPER(tela.marca) = :marca", { marca: input.marca.trim().toUpperCase() })
      .andWhere("UPPER(tela.modelo) = :modelo", { modelo: input.modelo.trim().toUpperCase() })
      .andWhere("UPPER(tela.numerotela) = :numero", { numero: input.numero.trim().toUpperCase() })
      .andWhere("tela.status != 'DESABILITADA'");

    if (input.fios) {
      query.andWhere("tela.fios = :fios", { fios: input.fios.trim() });
    }

    const results = await query.getMany();
    
    // Como a comparacao de JSON pode variar por ordem ou formatacao, filtramos em memoria a array de pecas
    const normalizedInputPecas = normalizePecas(input.pecas);
    const sortedInputPecas = [...normalizedInputPecas].sort().join("|");

    const matched = results.filter(entity => {
      let entityPecas: string[] = [];
      try {
        entityPecas = JSON.parse(entity.pecas ?? "[]");
      } catch (e) {
        entityPecas = [];
      }
      const sortedEntityPecas = [...normalizePecas(entityPecas)].sort().join("|");
      return sortedInputPecas === sortedEntityPecas;
    });

    return matched.map(mapTelaEntity);
  }

  private async insertTela(manager: EntityManager, command: CreateTelaCommand): Promise<TelaOrmEntity> {
    const usuario = String(command.usuarioCreate ?? "").trim().toUpperCase();
    if (!usuario) {
      throw new AppError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
    }

    let codbarrastela = resolveBarcode(command.data);
    if (!codbarrastela && command.autoGenerateBarcode) {
      codbarrastela = await this.generateUniqueBarcode(manager);
    }

    if (!codbarrastela) {
      throw new AppError(400, "CODIGO_BARRAS_OBRIGATORIO", "Código de barras não informado");
    }

    const marca = String(command.data.marca || "").trim().toUpperCase();
    const modelo = String(command.data.modelo || "").trim().toUpperCase();
    const numerotela = String(command.data.numerotela ?? command.data.numero ?? "").trim().toUpperCase();
    const datafabricacao =
      normalizeDate(command.data.datafabricacao ?? command.data.dataFabricacao)
      ?? normalizeDate(command.fallbackDataFabricacao);

    if (!marca || !modelo || !numerotela || !datafabricacao) {
      throw new AppError(
        400,
        "DADOS_INVALIDOS_CADASTRO",
        "Campos obrigatórios ausentes para cadastro",
      );
    }

    const duplicate = await manager.getRepository(TelaOrmEntity).findOne({
      where: { codbarrastela },
      select: { id: true },
    });

    if (duplicate) {
      throw new AppError(409, "TELA_DUPLICADA", "Tela já cadastrada", { codbarrastela });
    }

    const now = new Date(toBahiaSqlDateTime());
    const entity = manager.getRepository(TelaOrmEntity).create({
      createdate: now,
      updatedate: now,
      usuariocreate: usuario,
      marca,
      modelo,
      numerotela,
      cor: command.data.cor !== undefined && command.data.cor !== null ? String(command.data.cor).trim().toUpperCase() : null,
      fios: parseNullableNumber(command.data.fios) !== null ? String(parseNullableNumber(command.data.fios)) : null,
      datafabricacao,
      pecas: JSON.stringify(normalizePecas(command.data.pecas ?? command.data.components)),
      tamanho_etiqueta: command.data.tamanhoEtiqueta ?? command.data.tamanho_etiqueta
        ? String(command.data.tamanhoEtiqueta ?? command.data.tamanho_etiqueta).trim().toUpperCase()
        : null,
      codbarrastela,
      status: normalizeTelaStatus(command.data.status),
      usuariostatus: usuario,
      usuarioaltera: usuario,
      sku: command.data.sku ? String(command.data.sku).trim() : null,
    });

    return manager.getRepository(TelaOrmEntity).save(entity);
  }

  private applyTelaPatch(entity: TelaOrmEntity, data: EditTelaInput, usuario: string) {
    entity.updatedate = new Date(toBahiaSqlDateTime());
    entity.usuariostatus = usuario;
    entity.usuarioaltera = usuario;
    entity.marca = data.marca !== undefined ? String(data.marca || "").trim().toUpperCase() || null : entity.marca;
    entity.modelo = data.modelo !== undefined ? String(data.modelo || "").trim().toUpperCase() || null : entity.modelo;
    entity.numerotela = data.numerotela !== undefined
      ? String(data.numerotela || "").trim().toUpperCase() || null
      : data.numero !== undefined
        ? String(data.numero || "").trim().toUpperCase() || null
        : entity.numerotela;
    entity.cor = data.cor !== undefined
      ? (data.cor !== null ? String(data.cor).trim().toUpperCase() : null)
      : entity.cor;
    entity.fios = data.fios !== undefined
      ? parseNullableNumber(data.fios) !== null ? String(parseNullableNumber(data.fios)) : null
      : entity.fios;
    entity.datafabricacao = data.datafabricacao !== undefined || data.dataFabricacao !== undefined
      ? normalizeDate(data.datafabricacao ?? data.dataFabricacao)
      : entity.datafabricacao;
    entity.pecas = data.pecas !== undefined || data.components !== undefined
      ? JSON.stringify(normalizePecas(data.pecas ?? data.components))
      : entity.pecas;
    entity.status = data.status !== undefined ? normalizeTelaStatus(data.status) : entity.status;
    entity.endereco = data.endereco !== undefined ? String(data.endereco || "").trim().toUpperCase() || null : entity.endereco;

    const tamanhoEtiquetaRaw = data.tamanhoEtiqueta ?? data.tamanho_etiqueta;
    entity.tamanho_etiqueta = tamanhoEtiquetaRaw !== undefined
      ? String(tamanhoEtiquetaRaw || "").trim().toUpperCase() || null
      : entity.tamanho_etiqueta;
    entity.sku = data.sku !== undefined
      ? (data.sku !== null ? String(data.sku).trim() || null : null)
      : entity.sku;
  }

  private async generateUniqueBarcode(manager: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = generateBarcodeCandidate();
      const exists = await manager.getRepository(TelaOrmEntity).findOne({
        where: { codbarrastela: candidate },
        select: { id: true },
      });

      if (!exists) {
        return candidate;
      }
    }

    throw new AppError(500, "CODIGO_BARRAS_NAO_GERADO", "Nao foi possível gerar código de barras único");
  }

  async findByBarcode(barcode: string): Promise<Tela | null> {
    const repository = this.dataSource.getRepository(TelaOrmEntity);
    const entity = await repository.findOne({ where: { codbarrastela: String(barcode || "").trim().toUpperCase() } });
    return entity ? mapTelaEntity(entity) : null;
  }
}
