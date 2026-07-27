import { DataSource } from "typeorm";
import { TelaEnderecoOrmEntity } from "../../../infrastructure/database/entities/tela-endereco.entity.js";
import { TelaOrmEntity } from "../../../infrastructure/database/entities/tela.entity.js";
import { TypeOrmAuditEventsRepository } from "../../audit/infrastructure/typeorm-audit-events.repository.js";
import { AppError } from "../../../shared/domain/errors/app-error.js";
import { toBahiaSqlDateTime } from "../../../shared/utils/date.js";
import {
  AllocateTelasResult,
  ITelasEnderecosRepository,
} from "../application/contracts/telas-enderecos.repository.js";
import { CreateTelaEnderecoInput } from "../application/dtos/tela-endereco.dto.js";
import { TelaEndereco } from "../domain/tela-endereco.js";
import {
  getTelaStatusForEnderecoType,
  normalizeTelaEnderecoType,
  TelaEnderecoType,
} from "../domain/tela-endereco-type.js";
import { TELA_STATUS } from "../domain/tela-status.js";

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
  type: normalizeTelaEnderecoType(entity.type),
  metadata: entity.metadata ?? {},
  active: entity.active,
  vagas: entity.vagas,
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
    const type = normalizeTelaEnderecoType(data.type);
    const metadata = data.metadata ?? {};
    const vagas = Number(data.vagas);

    if (!address) {
      throw new AppError(400, "ENDERECO_OBRIGATORIO", "O endereço não pode ser vazio.");
    }
    if (!Number.isInteger(vagas) || vagas <= 0) {
      throw new AppError(400, "VAGAS_INVALIDAS", "A quantidade de vagas deve ser um número inteiro maior que 0.");
    }

    const repository = this.dataSource.getRepository(TelaEnderecoOrmEntity);
    const existing = await repository.findOne({ where: { address } });
    if (existing) {
      throw new AppError(409, "ENDERECO_DUPLICADO", `O endereço ${address} já está cadastrado.`);
    }

    // Mantém compatibilidade com os QR codes atuais. O barcode é o código estável
    // utilizado pelos leitores e também é gerado para os novos endereços de produção.
    const barcode = address;

    const entity = repository.create({
      address,
      type,
      metadata,
      active: true,
      vagas,
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

  async listAll(type?: string): Promise<TelaEndereco[]> {
    const repository = this.dataSource.getRepository(TelaEnderecoOrmEntity);
    const normalizedType = type ? normalizeTelaEnderecoType(type) : null;
    const entities = await repository.find({
      where: normalizedType ? { type: normalizedType, active: true } : { active: true },
      order: { type: "ASC", address: "ASC" },
    });
    return entities.map(mapEnderecoEntity);
  }

  async countOccupiedVagas(addressValue: string): Promise<number> {
    const normalizedAddress = String(addressValue || "").trim().toUpperCase();
    const address = await this.dataSource.getRepository(TelaEnderecoOrmEntity).findOne({
      where: { address: normalizedAddress },
    });
    const screensRepository = this.dataSource.getRepository(TelaOrmEntity);

    if (!address) {
      return screensRepository.count({ where: { endereco: normalizedAddress } });
    }

    return screensRepository
      .createQueryBuilder("tela")
      .where("tela.enderecoId = :addressId", { addressId: address.id })
      .orWhere("(tela.enderecoId IS NULL AND UPPER(COALESCE(tela.endereco, '')) = :address)", {
        address: normalizedAddress,
      })
      .getCount();
  }

  async allocateTelas(barcodeEndereco: string, codigosTelas: string[], usuario: string): Promise<AllocateTelasResult> {
    const barcode = String(barcodeEndereco || "").trim().toUpperCase();
    const codes = codigosTelas.map((codigo) => String(codigo || "").trim().toUpperCase());

    return this.dataSource.transaction(async (manager) => {
      const addresses = manager.getRepository(TelaEnderecoOrmEntity);
      const address = await addresses
        .createQueryBuilder("endereco")
        .setLock("pessimistic_write")
        .where("endereco.barcode = :barcode", { barcode })
        .getOne();

      if (!address || !address.active) {
        throw new AppError(404, "ENDERECO_NAO_ENCONTRADO", `O endereço com código ${barcode} não foi encontrado ou está inativo.`);
      }

      const addressType = normalizeTelaEnderecoType(address.type);
      const destinationStatus = getTelaStatusForEnderecoType(addressType);
      const telasRepository = manager.getRepository(TelaOrmEntity);
      const telas = await telasRepository
        .createQueryBuilder("tela")
        .setLock("pessimistic_write")
        .where("tela.codbarrastela IN (:...codes)", { codes })
        .getMany();
      const telasPorCodigo = new Map(telas.map((tela) => [String(tela.codbarrastela || "").toUpperCase(), tela]));
      const missing = codes.find((code) => !telasPorCodigo.has(code));

      if (missing) {
        throw new AppError(404, "TELA_NAO_ENCONTRADA", `A tela com código ${missing} não foi encontrada.`);
      }

      const alreadyAtDestination: string[] = [];
      const telasParaTransferir = codes
        .map((code) => telasPorCodigo.get(code)!)
        .filter((tela) => {
          const sameById = tela.enderecoId !== null && String(tela.enderecoId) === String(address.id);
          const sameByLegacyAddress = !tela.enderecoId && String(tela.endereco || "").toUpperCase() === address.address;
          if (sameById || sameByLegacyAddress) {
            alreadyAtDestination.push(String(tela.codbarrastela || ""));
            return false;
          }
          return true;
        });

      const occupied = await telasRepository
        .createQueryBuilder("tela")
        .where("tela.enderecoId = :addressId", { addressId: address.id })
        .orWhere("(tela.enderecoId IS NULL AND UPPER(COALESCE(tela.endereco, '')) = :address)", {
          address: address.address,
        })
        .getCount();
      const available = address.vagas - occupied;

      if (telasParaTransferir.length > available) {
        throw new AppError(
          400,
          "VAGAS_INSUFICIENTES",
          `Vagas insuficientes no endereço ${address.address}. Vagas disponíveis: ${Math.max(0, available)}. Telas a transferir: ${telasParaTransferir.length}.`,
        );
      }

      const now = new Date(toBahiaSqlDateTime());
      const transfers: AllocateTelasResult["transfers"] = [];

      for (const tela of telasParaTransferir) {
        const previousAddress = tela.endereco;
        const previousStatus = tela.status;
        const beforeState = {
          enderecoId: tela.enderecoId,
          endereco: previousAddress,
          status: previousStatus,
          usuarioendereco: tela.usuarioendereco,
        };

        tela.enderecoId = address.id;
        tela.endereco = address.address;
        tela.status = destinationStatus;
        tela.usuarioendereco = usuario;
        tela.usuariostatus = usuario;
        tela.usuarioaltera = usuario;
        tela.updatedate = now;
        await telasRepository.save(tela);

        const transfer = {
          screenCode: String(tela.codbarrastela || ""),
          from: previousAddress,
          to: address.address,
          previousStatus,
          newStatus: destinationStatus,
        };
        transfers.push(transfer);

        await this.auditRepository.create(
          {
            entityType: "TELA",
            entityId: tela.codbarrastela ?? "",
            action: previousAddress ? "ENDERECO_TRANSFERIDO" : "ENDERECO_ATUALIZADO",
            actorUsuario: usuario,
            beforeState,
            afterState: {
              enderecoId: Number(address.id),
              endereco: address.address,
              tipoEndereco: addressType,
              status: destinationStatus,
              usuarioendereco: usuario,
            },
            metadata: {
              enderecoOrigem: previousAddress,
              enderecoDestino: address.address,
              tipoDestino: addressType,
              transferenciaAutomatica: Boolean(previousAddress),
            },
          },
          manager,
        );
      }

      return {
        updatedCount: transfers.length,
        destination: mapEnderecoEntity(address),
        transfers,
        alreadyAtDestination,
      };
    });
  }

  async clearAddress(id: number, usuario: string): Promise<{ address: string; telasLiberadas: number }> {
    return this.dataSource.transaction(async (manager) => {
      const addresses = manager.getRepository(TelaEnderecoOrmEntity);
      const address = await addresses
        .createQueryBuilder("endereco")
        .setLock("pessimistic_write")
        .where("endereco.id = :id", { id: String(id) })
        .getOne();
      if (!address) {
        throw new AppError(404, "ENDERECO_NAO_ENCONTRADO", "Endereço não encontrado.");
      }

      const telasRepository = manager.getRepository(TelaOrmEntity);
      const telas = await telasRepository
        .createQueryBuilder("tela")
        .setLock("pessimistic_write")
        .where("tela.enderecoId = :addressId", { addressId: address.id })
        .orWhere("(tela.enderecoId IS NULL AND UPPER(COALESCE(tela.endereco, '')) = :address)", {
          address: address.address,
        })
        .getMany();
      const now = new Date(toBahiaSqlDateTime());

      for (const tela of telas) {
        const beforeState = {
          enderecoId: tela.enderecoId,
          endereco: tela.endereco,
          status: tela.status,
          usuarioendereco: tela.usuarioendereco,
        };
        tela.enderecoId = null;
        tela.endereco = null;
        tela.status = TELA_STATUS.SEM_ENDERECO;
        tela.usuarioendereco = usuario;
        tela.usuariostatus = usuario;
        tela.usuarioaltera = usuario;
        tela.updatedate = now;
        await telasRepository.save(tela);
        await this.auditRepository.create(
          {
            entityType: "TELA",
            entityId: tela.codbarrastela ?? "",
            action: "ENDERECO_REMOVIDO",
            actorUsuario: usuario,
            beforeState,
            afterState: {
              enderecoId: null,
              endereco: null,
              status: TELA_STATUS.SEM_ENDERECO,
              usuarioendereco: usuario,
            },
            metadata: { motivo: "LIMPEZA_ENDERECO", endereco: address.address },
          },
          manager,
        );
      }

      return { address: address.address, telasLiberadas: telas.length };
    });
  }

  async updateVagas(id: number, vagas: number, user: string): Promise<TelaEndereco> {
    if (!Number.isInteger(vagas) || vagas <= 0) {
      throw new AppError(400, "VAGAS_INVALIDAS", "A quantidade de vagas deve ser um número inteiro maior que 0.");
    }

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TelaEnderecoOrmEntity);
      const entity = await repository
        .createQueryBuilder("endereco")
        .setLock("pessimistic_write")
        .where("endereco.id = :id", { id: String(id) })
        .getOne();
      if (!entity) {
        throw new AppError(404, "ENDERECO_NAO_ENCONTRADO", "Endereço não encontrado.");
      }

      const occupied = await manager
        .getRepository(TelaOrmEntity)
        .createQueryBuilder("tela")
        .where("tela.enderecoId = :addressId", { addressId: entity.id })
        .orWhere("(tela.enderecoId IS NULL AND UPPER(COALESCE(tela.endereco, '')) = :address)", {
          address: entity.address,
        })
        .getCount();
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
      const entity = await repository
        .createQueryBuilder("endereco")
        .setLock("pessimistic_write")
        .where("endereco.id = :id", { id: String(id) })
        .getOne();
      if (!entity) {
        throw new AppError(404, "ENDERECO_NAO_ENCONTRADO", "Endereço não encontrado.");
      }

      const occupied = await manager
        .getRepository(TelaOrmEntity)
        .createQueryBuilder("tela")
        .where("tela.enderecoId = :addressId", { addressId: entity.id })
        .orWhere("(tela.enderecoId IS NULL AND UPPER(COALESCE(tela.endereco, '')) = :address)", {
          address: entity.address,
        })
        .getCount();
      if (occupied > 0) {
        throw new AppError(400, "ENDERECO_OCUPADO", "Não é possível excluir um endereço que possui telas alocadas.");
      }

      await repository.remove(entity);
    });
  }
}
