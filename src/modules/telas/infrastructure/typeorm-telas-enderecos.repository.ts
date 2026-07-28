import { DataSource, EntityManager } from "typeorm";
import { TelaEnderecoOrmEntity } from "../../../infrastructure/database/entities/tela-endereco.entity.js";
import { TelaOrmEntity } from "../../../infrastructure/database/entities/tela.entity.js";
import { TypeOrmAuditEventsRepository } from "../../audit/infrastructure/typeorm-audit-events.repository.js";
import { AppError } from "../../../shared/domain/errors/app-error.js";
import { toBahiaSqlDateTime } from "../../../shared/utils/date.js";
import { ITelasEnderecosRepository } from "../application/contracts/telas-enderecos.repository.js";
import { CreateTelaEnderecoInput } from "../application/dtos/tela-endereco.dto.js";
import { TELA_ENDERECO_TIPO, TelaEndereco, TelaEnderecoTipo } from "../domain/tela-endereco.js";
import { TELA_STATUS } from "../domain/tela-status.js";
import { DEFAULT_ADDRESS_MAX_CAPACITY } from "../../config/domain/app-config.js";

type PersistenceDriverError = {
  code?: unknown;
  column?: unknown;
  constraint?: unknown;
};

const getPersistenceDriverError = (error: unknown): PersistenceDriverError => {
  if (!error || typeof error !== "object") return {};

  const candidate = error as { driverError?: unknown };
  if (candidate.driverError && typeof candidate.driverError === "object") {
    return candidate.driverError as PersistenceDriverError;
  }

  return error as PersistenceDriverError;
};

const mapCreatePersistenceError = (error: unknown): AppError | null => {
  const driverError = getPersistenceDriverError(error);
  const code = String(driverError.code ?? "");
  const constraint = String(driverError.constraint ?? "").toLowerCase();

  if (code === "23505" && (constraint.includes("address") || constraint.includes("barcode"))) {
    return new AppError(409, "ENDERECO_DUPLICADO", "O endereço informado já está cadastrado.");
  }

  if (code === "23505" && constraint.includes("pkey")) {
    return new AppError(
      500,
      "SEQUENCIA_ENDERECO_INVALIDA",
      "Não foi possível gerar o identificador do endereço. Sincronize a sequência do cadastro e tente novamente.",
    );
  }

  if (code === "23502") {
    return new AppError(400, "DADOS_ENDERECO_INCOMPLETOS", "Os dados obrigatórios do endereço não foram informados.");
  }

  if (code === "22001") {
    return new AppError(400, "DADOS_ENDERECO_LONGOS", "Os dados do endereço excedem o tamanho permitido.");
  }

  return null;
};

const mapEnderecoEntity = (entity: TelaEnderecoOrmEntity): TelaEndereco => ({
  id: Number(entity.id),
  address: entity.address,
  vagas: entity.vagas,
  tipo: entity.tipo as TelaEnderecoTipo,
  nome: entity.nome,
  numero: entity.numero,
  barcode: entity.barcode,
  usercreate: entity.usercreate,
  user_edit: entity.user_edit,
  created_ad: entity.created_ad,
  edited_at: entity.edited_at,
});

export class TypeOrmTelasEnderecosRepository implements ITelasEnderecosRepository {
  private readonly auditRepository: TypeOrmAuditEventsRepository;

  constructor(private readonly dataSource: DataSource) {
    this.auditRepository = new TypeOrmAuditEventsRepository(dataSource);
  }

  async create(data: CreateTelaEnderecoInput, user: string): Promise<TelaEndereco> {
    const address = String(data.address || "").trim().toUpperCase();
    const vagas = Number(data.vagas);
    const tipo = String(data.tipo || TELA_ENDERECO_TIPO.INVENTARIO).trim().toUpperCase() as TelaEnderecoTipo;
    const nome = tipo === TELA_ENDERECO_TIPO.PRODUCAO ? String(data.nome || "").trim().toUpperCase() : null;
    const numero = tipo === TELA_ENDERECO_TIPO.PRODUCAO ? Number(data.numero) : null;

    if (!address) {
      throw new AppError(400, "ENDERECO_OBRIGATORIO", "O endereço não pode ser vazio.");
    }
    if (isNaN(vagas) || vagas <= 0) {
      throw new AppError(400, "VAGAS_INVALIDAS", "A quantidade de vagas deve ser maior que 0.");
    }

    const repository = this.dataSource.getRepository(TelaEnderecoOrmEntity);
    const existing = await repository.findOne({ where: { address } });
    if (existing) {
      throw new AppError(409, "ENDERECO_DUPLICADO", `O endereço ${address} já está cadastrado.`);
    }

    // Barcode corresponds exactly to the normalized address format (ex: "01-01-01")
    const barcode = address;

    const entity = repository.create({
      address,
      vagas,
      tipo,
      nome,
      numero,
      barcode,
      usercreate: user,
      created_ad: new Date(),
    });

    try {
      const saved = await repository.save(entity);
      return mapEnderecoEntity(saved);
    } catch (error) {
      const mappedError = mapCreatePersistenceError(error);
      if (mappedError) throw mappedError;
      throw error;
    }
  }

  async findByBarcode(barcode: string): Promise<TelaEndereco | null> {
    const repository = this.dataSource.getRepository(TelaEnderecoOrmEntity);
    const entity = await repository.findOne({
      where: { barcode: String(barcode || "").trim().toUpperCase() },
    });
    return entity ? mapEnderecoEntity(entity) : null;
  }

  async findByAddress(address: string): Promise<TelaEndereco | null> {
    const repository = this.dataSource.getRepository(TelaEnderecoOrmEntity);
    const entity = await repository.findOne({
      where: { address: String(address || "").trim().toUpperCase() },
    });
    return entity ? mapEnderecoEntity(entity) : null;
  }

  async listAll(): Promise<TelaEndereco[]> {
    const repository = this.dataSource.getRepository(TelaEnderecoOrmEntity);
    const entities = await repository.find({ order: { address: "ASC" } });
    return entities.map(mapEnderecoEntity);
  }

  async countOccupiedVagas(address: string): Promise<number> {
    const screensRepository = this.dataSource.getRepository(TelaOrmEntity);
    const count = await screensRepository.count({
      where: {
        endereco: String(address || "").trim().toUpperCase(),
      },
    });
    return count;
  }

  async allocateTelas(barcodeEndereco: string, codigosTelas: string[], usuario: string): Promise<number> {
    const barcode = String(barcodeEndereco || "").trim().toUpperCase();
    const codes = codigosTelas.map((codigo) => String(codigo || "").trim().toUpperCase());

    return this.dataSource.transaction(async (manager) => {
      const addresses = manager.getRepository(TelaEnderecoOrmEntity);
      const address = await addresses.createQueryBuilder("endereco")
        .setLock("pessimistic_write")
        .where("endereco.barcode = :barcode", { barcode })
        .getOne();

      if (!address) {
        throw new AppError(404, "ENDERECO_NAO_ENCONTRADO", `O endereço com código de barras ${barcode} não foi encontrado.`);
      }

      const telasRepository = manager.getRepository(TelaOrmEntity);
      const telas = await telasRepository.createQueryBuilder("tela")
        .setLock("pessimistic_write")
        .where("tela.codbarrastela IN (:...codes)", { codes })
        .getMany();
      const telasPorCodigo = new Map(telas.map((tela) => [String(tela.codbarrastela || "").toUpperCase(), tela]));
      const missing = codes.find((code) => !telasPorCodigo.has(code));
      if (missing) {
        throw new AppError(404, "TELA_NAO_ENCONTRADA", `A tela com código ${missing} não foi encontrada.`);
      }

      const telasParaAlocar = codes
        .map((code) => telasPorCodigo.get(code)!)
        .filter((tela) => tela.endereco !== address.address);
      const occupied = await telasRepository.count({ where: { endereco: address.address } });
      const available = address.vagas - occupied;
      if (telasParaAlocar.length > available) {
        throw new AppError(
          400,
          "VAGAS_INSUFICIENTES",
          `Vagas insuficientes no endereço ${address.address}. Vagas disponíveis: ${Math.max(0, available)}. Telas a alocar: ${telasParaAlocar.length}.`,
        );
      }

      const now = new Date(toBahiaSqlDateTime());
      const novoStatus = address.tipo === TELA_ENDERECO_TIPO.PRODUCAO
        ? TELA_STATUS.PRODUCAO
        : TELA_STATUS.ARMAZENADA;
      for (const tela of telasParaAlocar) {
        const beforeState = {
          endereco: tela.endereco,
          usuarioendereco: tela.usuarioendereco,
          status: tela.status,
        };
        tela.endereco = address.address;
        tela.usuarioendereco = usuario;
        tela.status = novoStatus;
        tela.usuariostatus = usuario;
        tela.usuarioaltera = usuario;
        tela.updatedate = now;
        await telasRepository.save(tela);
        await this.auditRepository.create({
          entityType: "TELA",
          entityId: tela.codbarrastela ?? "",
          action: "ENDERECO_ATUALIZADO",
          actorUsuario: usuario,
          beforeState,
          afterState: {
            endereco: address.address,
            usuarioendereco: usuario,
            status: novoStatus,
          },
        }, manager);
      }

      return telasParaAlocar.length;
    });
  }

  async clearAddress(id: number, usuario: string): Promise<{ address: string; telasLiberadas: number }> {
    return this.dataSource.transaction(async (manager) => {
      const addresses = manager.getRepository(TelaEnderecoOrmEntity);
      const address = await addresses.createQueryBuilder("endereco")
        .setLock("pessimistic_write")
        .where("endereco.id = :id", { id: String(id) })
        .getOne();
      if (!address) {
        throw new AppError(404, "ENDERECO_NAO_ENCONTRADO", "Endereço não encontrado.");
      }

      const telasRepository = manager.getRepository(TelaOrmEntity);
      const telas = await telasRepository.createQueryBuilder("tela")
        .setLock("pessimistic_write")
        .where("tela.endereco = :address", { address: address.address })
        .getMany();
      const now = new Date(toBahiaSqlDateTime());

      for (const tela of telas) {
        const beforeState = {
          endereco: tela.endereco,
          usuarioendereco: tela.usuarioendereco,
          status: tela.status,
        };
        tela.endereco = null;
        tela.usuarioendereco = usuario;
        tela.status = TELA_STATUS.SEM_ENDERECO;
        tela.usuariostatus = usuario;
        tela.usuarioaltera = usuario;
        tela.updatedate = now;
        await telasRepository.save(tela);
        await this.auditRepository.create({
          entityType: "TELA",
          entityId: tela.codbarrastela ?? "",
          action: "ENDERECO_REMOVIDO",
          actorUsuario: usuario,
          beforeState,
          afterState: {
            endereco: null,
            usuarioendereco: usuario,
            status: TELA_STATUS.SEM_ENDERECO,
          },
          metadata: { motivo: "LIMPEZA_ENDERECO", endereco: address.address },
        }, manager);
      }

      return { address: address.address, telasLiberadas: telas.length };
    });
  }

  async updateVagas(
    id: number,
    vagas: number,
    user: string,
    maxCapacity = DEFAULT_ADDRESS_MAX_CAPACITY,
  ): Promise<TelaEndereco> {
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

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TelaEnderecoOrmEntity);
      const entity = await repository.createQueryBuilder("endereco")
        .setLock("pessimistic_write")
        .where("endereco.id = :id", { id: String(id) })
        .getOne();
      if (!entity) {
        throw new AppError(404, "ENDERECO_NAO_ENCONTRADO", "Endereço não encontrado.");
      }
      const occupied = await manager.getRepository(TelaOrmEntity).count({ where: { endereco: entity.address } });
      if (vagas < occupied) {
        throw new AppError(400, "VAGAS_ABAIXO_OCUPACAO", `A capacidade não pode ser menor que as ${occupied} telas ocupadas.`);
      }

      entity.vagas = vagas;
      entity.user_edit = user;
      entity.edited_at = new Date();
      const saved = await repository.save(entity);
      return mapEnderecoEntity(saved);
    });
  }

  async delete(id: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TelaEnderecoOrmEntity);
      const entity = await repository.createQueryBuilder("endereco")
        .setLock("pessimistic_write")
        .where("endereco.id = :id", { id: String(id) })
        .getOne();
      if (!entity) {
        throw new AppError(404, "ENDERECO_NAO_ENCONTRADO", "Endereço não encontrado.");
      }

      const occupied = await manager.getRepository(TelaOrmEntity).count({ where: { endereco: entity.address } });
      if (occupied > 0) {
        throw new AppError(400, "ENDERECO_OCUPADO", "Não é possível excluir um endereço que possui telas alocadas.");
      }

      await repository.remove(entity);
    });
  }
}
