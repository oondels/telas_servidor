import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "../../config/env.js";
import { loggerMiddleware } from "./middlewares/logger-middleware.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.js";
import { registerRoutes } from "./routes/index.js";

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: ["http://localhost:5173"], credentials: true }));
  app.use(cookieParser());
  app.use(express.json());
  app.use(loggerMiddleware);

  registerRoutes(app);
  app.use(errorHandlerMiddleware);

  return app;
};
