import { DataSource, EntityManager } from "typeorm";
import { TelaEnderecoOrmEntity } from "../../../infrastructure/database/entities/tela-endereco.entity.js";
import { TelaOrmEntity } from "../../../infrastructure/database/entities/tela.entity.js";
import { TypeOrmAuditEventsRepository } from "../../audit/infrastructure/typeorm-audit-events.repository.js";
import { AppError } from "../../../shared/domain/errors/app-error.js";
import { toBahiaSqlDateTime } from "../../../shared/utils/date.js";
import { ITelasEnderecosRepository } from "../application/contracts/telas-enderecos.repository.js";
import { CreateTelaEnderecoInput } from "../application/dtos/tela-endereco.dto.js";
import { TelaEndereco } from "../domain/tela-endereco.js";

const mapEnderecoEntity = (entity: TelaEnderecoOrmEntity): TelaEndereco => ({
  id: Number(entity.id),
  address: entity.address,
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
    const vagas = Number(data.vagas);

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
      barcode,
      usercreate: user,
      created_ad: new Date(),
    });

    const saved = await repository.save(entity);
    return mapEnderecoEntity(saved);
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

      const alreadyAllocated = codes
        .map((code) => telasPorCodigo.get(code)!)
        .find((tela) => tela.endereco && tela.endereco !== address.address);
      if (alreadyAllocated) {
        throw new AppError(
          409,
          "TELA_JA_ENDERECADA",
          `A tela ${alreadyAllocated.codbarrastela} já está alocada no endereço ${alreadyAllocated.endereco}. Libere-a antes de reendereçar.`,
          { codbarrastela: alreadyAllocated.codbarrastela, enderecoAtual: alreadyAllocated.endereco },
        );
      }

      const telasParaAlocar = codes
        .map((code) => telasPorCodigo.get(code)!)
        .filter((tela) => !tela.endereco);
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
      for (const tela of telasParaAlocar) {
        const beforeState = { endereco: tela.endereco, usuarioendereco: tela.usuarioendereco };
        tela.endereco = address.address;
        tela.usuarioendereco = usuario;
        tela.usuarioaltera = usuario;
        tela.updatedate = now;
        await telasRepository.save(tela);
        await this.auditRepository.create({
          entityType: "TELA",
          entityId: tela.codbarrastela ?? "",
          action: "ENDERECO_ATUALIZADO",
          actorUsuario: usuario,
          beforeState,
          afterState: { endereco: address.address, usuarioendereco: usuario },
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
        const beforeState = { endereco: tela.endereco, usuarioendereco: tela.usuarioendereco };
        tela.endereco = null;
        tela.usuarioendereco = usuario;
        tela.usuarioaltera = usuario;
        tela.updatedate = now;
        await telasRepository.save(tela);
        await this.auditRepository.create({
          entityType: "TELA",
          entityId: tela.codbarrastela ?? "",
          action: "ENDERECO_REMOVIDO",
          actorUsuario: usuario,
          beforeState,
          afterState: { endereco: null, usuarioendereco: usuario },
          metadata: { motivo: "LIMPEZA_ENDERECO", endereco: address.address },
        }, manager);
      }

      return { address: address.address, telasLiberadas: telas.length };
    });
  }

  async updateVagas(id: number, vagas: number, user: string): Promise<TelaEndereco> {
    if (isNaN(vagas) || vagas <= 0) {
      throw new AppError(400, "VAGAS_INVALIDAS", "A quantidade de vagas deve ser maior que 0.");
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
