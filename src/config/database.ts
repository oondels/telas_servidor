import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "./env.js";
import { SolicitacaoOrmEntity } from "../infrastructure/database/entities/solicitacao.entity.js";
import { TelaOrmEntity } from "../infrastructure/database/entities/tela.entity.js";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: env.IP,
  port: env.PORT,
  username: env.USERS,
  password: env.PASS,
  database: env.DBASE,
  entities: [TelaOrmEntity, SolicitacaoOrmEntity],
  migrations: ["src/infrastructure/database/migrations/*.ts", "dist/infrastructure/database/migrations/*.js"],
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
