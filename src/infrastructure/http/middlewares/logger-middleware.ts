import { randomUUID } from "node:crypto";
import pinoHttp from "pino-http";
import { Request, Response } from "express";
import { logger } from "../../../shared/http/logger.js";

export const loggerMiddleware = pinoHttp.pinoHttp({
  logger,
  genReqId: () => randomUUID(),
  customProps: (req: any, res: any) => {
    // Acessa o usuário caso ele já tenha passado pelo middleware de auth (verificação JWT)
    const user = req.user;
    return {
      matricula: user?.matricula,
    };
  },
  serializers: {
    req: (req: any) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
    }),
    err: pinoHttp.stdSerializers.err,
  },
});
