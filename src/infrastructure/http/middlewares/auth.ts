import jwt, { JwtPayload } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { env } from "../../../config/env.js";
import { sendError } from "../../../shared/http/http-response.js";

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[env.JWT_COOKIE_NAME];

  if (!token) {
    return sendError(res, 401, "TOKEN_NAO_FORNECIDO", "Acesso negado! Token de acesso não fornecido!");
  }

  jwt.verify(token, env.JWT_SECRET, (error, decoded) => {
    if (error || !decoded) {
      return sendError(
        res,
        401,
        "TOKEN_INVALIDO",
        "Acesso negado! Você não tem permissões para acessar essa rota!",
      );
    }

    req.user = decoded as JwtPayload;
    return next();
  });
};
