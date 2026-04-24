import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "../../config/env.js";
import { requestContextMiddleware } from "./middlewares/request-context.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.js";
import { registerRoutes } from "./routes/index.js";

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());
  app.use(requestContextMiddleware);

  registerRoutes(app);
  app.use(errorHandlerMiddleware);

  return app;
};
