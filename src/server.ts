import "reflect-metadata";
import { env } from "./config/env.js";
import { initializeDatabase } from "./config/database.js";
import { createApp } from "./infrastructure/http/app.js";
import { logEvent } from "./shared/http/logger.js";

const bootstrap = async () => {
  await initializeDatabase();

  const app = createApp();
  app.listen(env.API_PORT, () => {
    logEvent("info", "server.started", { port: env.API_PORT });
  });
};

bootstrap().catch((error: Error) => {
  logEvent("error", "server.start.failed", {
    error: error.message,
  });
  process.exit(1);
});
