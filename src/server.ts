import "reflect-metadata";
import { env } from "./config/env.js";
import { initializeDatabase } from "./config/database.js";
import { createApp } from "./infrastructure/http/app.js";
import { logger } from "./shared/http/logger.js";

const bootstrap = async () => {
  await initializeDatabase();

  const app = createApp();
  app.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT }, "server.started");
  });
};

bootstrap().catch((error: Error) => {
  logger.fatal({ err: error }, "server.start.failed");
  process.exit(1);
});
