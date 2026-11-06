import jwt, { JwtPayload, VerifyErrors } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { env } from "../../../config/env.js";
import { sendError } from "../../../shared/http/http-response.js";

export const extractCandidateTokens = (req: Request): string[] => {
  const authHeader = req.headers?.authorization;
  const bearerToken = authHeader && /^Bearer\s+/i.test(authHeader)
    ? authHeader.replace(/^Bearer\s+/i, "").trim()
    : null;
  const cookieToken = req.cookies?.[env.JWT_COOKIE_NAME]
    ? String(req.cookies[env.JWT_COOKIE_NAME]).trim()
    : null;
  const candidates = [cookieToken, bearerToken].filter((t): t is string => Boolean(t));
  return [...new Set(candidates)];
};

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const tokens = extractCandidateTokens(req);

  if (tokens.length === 0) {
    return sendError(res, 401, "TOKEN_NAO_FORNECIDO", "Acesso negado! Token de acesso não fornecido!");
  }

  for (const token of tokens) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (decoded && typeof decoded !== "string") {
        req.user = decoded as JwtPayload;
        return next();
      }
    } catch (_error) {
      // tenta próximo candidato (cookie ou Bearer)
    }
  }

  return sendError(
    res,
    401,
    "TOKEN_INVALIDO",
    "Acesso negado! Você não tem permissões para acessar essa rota!",
  );
};
