import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "./env.js";
import { SolicitacaoOrmEntity } from "../infrastructure/database/entities/solicitacao.entity.js";
import { TelaOrmEntity } from "../infrastructure/database/entities/tela.entity.js";
import { AppUserOrmEntity } from "../infrastructure/database/entities/app-user.entity.js";
import { AuditEventOrmEntity } from "../infrastructure/database/entities/audit-event.entity.js";
import { AppConfigOrmEntity } from "../infrastructure/database/entities/app-config.entity.js";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: env.IP,
  port: env.PORT,
  username: env.USERS,
  password: env.PASS,
  database: env.DBASE,
  entities: [TelaOrmEntity, SolicitacaoOrmEntity, AppUserOrmEntity, AuditEventOrmEntity, AppConfigOrmEntity],
  migrations: import.meta.url.endsWith(".js")
    ? ["dist/infrastructure/database/migrations/*.js"]
    : ["src/infrastructure/database/migrations/*.ts"],
  migrationsTableName: "typeorm_migrations",
  synchronize: false,
  logging: false,
});

export const initializeDatabase = async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  return AppDataSource;
};
