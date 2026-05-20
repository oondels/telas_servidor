import { NextFunction, Request, Response } from "express";
import { AppError } from "../../../shared/domain/errors/app-error.js";
import { sendError } from "../../../shared/http/http-response.js";
import { logger } from "../../../shared/http/logger.js";

export const errorHandlerMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    sendError(res, error.statusCode, error.code, error.message, error.details);
    return;
  }

  // Se req.log estiver disponível (injetado pelo pino-http), usamos para manter o rastro (req.id)
  const log = req.log || logger;

  log.error({
    err: error,
    msg: "unhandled.error",
  });

  sendError(res, 500, "UNHANDLED_EXCEPTION", "Erro interno não tratado");
};
