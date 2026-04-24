import { DataSource } from "typeorm";
import { env } from "../../config/env.js";
import { SolicitacaoOrmEntity } from "./entities/solicitacao.entity.js";
import { TelaOrmEntity } from "./entities/tela.entity.js";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: env.IP,
  port: env.PORT,
  username: env.USERS,
  password: env.PASS,
  database: env.DBASE,
  entities: [TelaOrmEntity, SolicitacaoOrmEntity],
  synchronize: false,
  logging: false,
});

export const initializeDatabase = async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  return AppDataSource;
};
