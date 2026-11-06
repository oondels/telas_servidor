import { NextFunction, Request, Response } from "express";
import { TypeOrmUsersRepository } from "../../../modules/users/infrastructure/typeorm-users.repository.js";
import { UserRole, USER_ROLES } from "../../../modules/users/domain/user-role.js";
import { getAuthenticatedMatricula, getAuthenticatedUser } from "../../../shared/auth/auth-context.js";
import { AppError } from "../../../shared/domain/errors/app-error.js";

export const loadActiveUser = (usersRepository: TypeOrmUsersRepository) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const matricula = getAuthenticatedMatricula(req);
    const jwtUser = getAuthenticatedUser(req);

    if (typeof jwtUser?.is_admin !== "boolean" && typeof usersRepository.isCentralAdmin === "function") {
      const isCentralAdmin = await usersRepository.isCentralAdmin(
        matricula,
        jwtUser?.usuario ? String(jwtUser.usuario) : null,
      );
      if (jwtUser) {
        jwtUser.is_admin = isCentralAdmin;
      }
    }

    const user = await usersRepository.findActiveByMatricula(matricula);

    if (!user) {
      if (Boolean(jwtUser?.is_admin)) {
        req.appUser = {
          id: String(jwtUser.id ?? "admin"),
          matricula,
          nome: String(jwtUser.nome ?? jwtUser.usuario ?? "Administrador"),
          usuario: String(jwtUser.usuario ?? "admin"),
          setor: String(jwtUser.setor ?? "ADMINISTRACAO"),
          unidade: String(jwtUser.unidade ?? "SEST"),
          role: USER_ROLES.ADMIN,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return next();
      }

      throw new AppError(
        403,
        "USUARIO_NAO_AUTORIZADO",
        "Usuário não cadastrado ou inativo para acessar o servidor de telas",
      );
    }

    req.appUser = user;
    next();
  };
};

export const requireRoles = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.appUser) {
      throw new AppError(403, "USUARIO_APP_NAO_CARREGADO", "Usuário da aplicação não carregado");
    }

    if (!roles.includes(req.appUser.role)) {
      throw new AppError(403, "PERMISSAO_INSUFICIENTE", "Perfil sem permissão para executar esta operação");
    }

    next();
  };
};
