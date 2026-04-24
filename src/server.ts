import "reflect-metadata";
import { env } from "./config/env.js";
import { createApp } from "./infrastructure/http/app.js";
import { initializeDatabase } from "./infrastructure/database/data-source.js";
import { ensureLegacySchema } from "./infrastructure/database/schema-manager.js";
import { logEvent } from "./shared/http/logger.js";

const bootstrap = async () => {
  await initializeDatabase();
  await ensureLegacySchema();

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
