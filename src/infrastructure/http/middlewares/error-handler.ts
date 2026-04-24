import { NextFunction, Request, Response } from "express";
import { AppError } from "../../../shared/domain/errors/app-error.js";
import { sendError } from "../../../shared/http/http-response.js";
import { logEvent } from "../../../shared/http/logger.js";

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

  logEvent("error", "unhandled.error", {
    requestId: req.requestId,
    error: error instanceof Error ? error.message : "Unknown error",
  });

  sendError(res, 500, "UNHANDLED_EXCEPTION", "Erro interno não tratado");
};
