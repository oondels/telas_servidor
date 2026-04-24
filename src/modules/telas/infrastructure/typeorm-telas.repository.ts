import { DataSource, EntityManager } from "typeorm";
import { TelaOrmEntity } from "../../../infrastructure/database/entities/tela.entity.js";
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
  SearchTelasInput,
} from "../application/dtos/tela.dto.js";

const TABLE_NAME = "fabrica.controle_telas_prateleiras";

const mapTelaEntity = (entity: TelaOrmEntity): Tela => ({
  id: Number(entity.id),
  codbarrastela: entity.codbarrastela ?? "",
  marca: entity.marca,
  modelo: entity.modelo,
  numerotela: entity.numerotela,
  cor: entity.cor !== null ? Number(entity.cor) : null,
  fios: entity.fios !== null ? Number(entity.fios) : null,
  datafabricacao: entity.datafabricacao,
  pecas: entity.pecas,
  tamanho_etiqueta: entity.tamanho_etiqueta,
  status: entity.status,
  endereco: entity.endereco,
  createdate: entity.createdate,
  updatedate: entity.updatedate,
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
  constructor(private readonly dataSource: DataSource) {}

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
      return mapTelaEntity(entity);
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
      }

      return input.telas.length;
    });
  }

  async editByBarcode(codbarrastela: string, data: EditTelaInput, usuario: string): Promise<Tela | null> {
    const repository = this.dataSource.getRepository(TelaOrmEntity);
    const entity = await repository.findOne({ where: { codbarrastela } });

    if (!entity) {
      return null;
    }

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
      ? parseNullableNumber(data.cor) !== null ? String(parseNullableNumber(data.cor)) : null
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

    const saved = await repository.save(entity);
    return mapTelaEntity(saved);
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
          cor: Number(item.cor),
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
      cor: parseNullableNumber(command.data.cor) !== null ? String(parseNullableNumber(command.data.cor)) : null,
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
    });

    return manager.getRepository(TelaOrmEntity).save(entity);
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
}
