import { Express } from "express";
import { sendSuccess } from "../../../shared/http/http-response.js";

export const registerRoutes = (app: Express) => {
  app.get("/", (_req, res) => {
    return sendSuccess(res, 200, { message: "Servidor de Telas ativo" });
  });
};
