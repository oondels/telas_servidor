import { DataSource, EntityManager } from "typeorm";
import { TelaEnderecoOrmEntity } from "../../../infrastructure/database/entities/tela-endereco.entity.js";
import { TelaOrmEntity } from "../../../infrastructure/database/entities/tela.entity.js";
import { AppError } from "../../../shared/domain/errors/app-error.js";
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
  constructor(private readonly dataSource: DataSource) {}

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

  async updateVagas(id: number, vagas: number, user: string): Promise<TelaEndereco> {
    if (isNaN(vagas) || vagas <= 0) {
      throw new AppError(400, "VAGAS_INVALIDAS", "A quantidade de vagas deve ser maior que 0.");
    }

    const repository = this.dataSource.getRepository(TelaEnderecoOrmEntity);
    const entity = await repository.findOne({ where: { id: String(id) } });
    if (!entity) {
      throw new AppError(404, "ENDERECO_NAO_ENCONTRADO", "Endereço não encontrado.");
    }

    entity.vagas = vagas;
    entity.user_edit = user;
    entity.edited_at = new Date();

    const saved = await repository.save(entity);
    return mapEnderecoEntity(saved);
  }

  async delete(id: number): Promise<void> {
    const repository = this.dataSource.getRepository(TelaEnderecoOrmEntity);
    const entity = await repository.findOne({ where: { id: String(id) } });
    if (!entity) {
      throw new AppError(404, "ENDERECO_NAO_ENCONTRADO", "Endereço não encontrado.");
    }

    const occupied = await this.countOccupiedVagas(entity.address);
    if (occupied > 0) {
      throw new AppError(400, "ENDERECO_OCUPADO", "Não é possível excluir um endereço que possui telas alocadas.");
    }

    await repository.remove(entity);
  }
}
