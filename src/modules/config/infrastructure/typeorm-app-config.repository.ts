import { DataSource } from "typeorm";
import { AppConfigOrmEntity } from "../../../infrastructure/database/entities/app-config.entity.js";
import { AppError } from "../../../shared/domain/errors/app-error.js";
import { toBahiaSqlDateTime } from "../../../shared/utils/date.js";

const INACTIVE_TELAS_KEY = "telas_sem_movimentacao";
const DEFAULT_DAYS = 30;

export class TypeOrmAppConfigRepository {
  constructor(private readonly dataSource: DataSource) {}

  async getInactiveTelasConfig() {
    const entity = await this.dataSource.getRepository(AppConfigOrmEntity).findOne({
      where: { key: INACTIVE_TELAS_KEY },
    });

    const days = Number(entity?.value?.days ?? DEFAULT_DAYS);
    return {
      key: INACTIVE_TELAS_KEY,
      days: Number.isFinite(days) && days > 0 ? days : DEFAULT_DAYS,
      updatedAt: entity?.updated_at ?? null,
      updatedBy: entity?.updated_by !== null && entity?.updated_by !== undefined ? Number(entity.updated_by) : null,
    };
  }

  async updateInactiveTelasConfig(days: number, updatedBy: number) {
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      throw new AppError(400, "DIAS_INVALIDOS", "Informe um limite entre 1 e 3650 dias");
    }

    const repository = this.dataSource.getRepository(AppConfigOrmEntity);
    const now = new Date(toBahiaSqlDateTime());
    const entity = await repository.findOne({ where: { key: INACTIVE_TELAS_KEY } });

    const next = entity ?? repository.create({ key: INACTIVE_TELAS_KEY });
    next.value = { days };
    next.updated_at = now;
    next.updated_by = String(updatedBy);

    await repository.save(next);
    return this.getInactiveTelasConfig();
  }
}
