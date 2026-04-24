import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { logEvent } from "../../../shared/http/logger.js";

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = randomUUID();
  const startedAt = Date.now();

  req.requestId = requestId;
  res.locals.requestId = requestId;

  res.on("finish", () => {
    logEvent("info", "request.completed", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
};
