import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const parsePort = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 5432;
};

const poolConfig = {
  user: process.env.USERS,
  password: process.env.PASS,
  host: process.env.IP,
  port: parsePort(process.env.PORT),
  database: process.env.DBASE,
};

export const pool = new Pool(poolConfig);

pool.on("error", (error) => {
  console.error("Erro inesperado no pool do PostgreSQL:", error);
});

export const checkDatabaseConnection = async () => {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    return true;
  } finally {
    client.release();
  }
};

checkDatabaseConnection()
  .then(() => {
    console.log("Conectado ao banco de dados");
  })
  .catch((error) => {
    console.error("Erro ao conectar ao banco de dados:", error);
  });
