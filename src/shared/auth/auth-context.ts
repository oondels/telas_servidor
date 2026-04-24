import { Request } from "express";
import { AppError } from "../domain/errors/app-error.js";
import { parseMatricula } from "../utils/parsers.js";

export const getAuthenticatedUser = (req: Request) => {
  if (!req.user) {
    throw new AppError(401, "USUARIO_NAO_AUTENTICADO", "Usuário autenticado não informado");
  }

  return req.user;
};

export const getAuthenticatedMatricula = (req: Request): number => {
  const user = getAuthenticatedUser(req);
  const matricula = parseMatricula(user.matricula ?? user.usuario ?? user.id);

  if (!matricula) {
    throw new AppError(401, "MATRICULA_INVALIDA", "Token autenticado sem matrícula válida");
  }

  return matricula;
};

export const getAuthenticatedSetor = (req: Request): string | null => {
  const user = getAuthenticatedUser(req);
  const setor = String(user.setor ?? "").trim().toUpperCase();
  return setor || null;
};

export const ensureAllowedMatricula = (matricula: number, allowed: Set<number>, code: string, message: string) => {
  if (!allowed.has(matricula)) {
    throw new AppError(403, code, message);
  }
};

export const ensureAllowedSetor = (setor: string | null, allowed: Set<string>, code: string, message: string) => {
  if (!setor || !allowed.has(setor)) {
    throw new AppError(403, code, message);
  }
};
