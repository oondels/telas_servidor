import { NextFunction, Request, Response } from "express";
import { TypeOrmUsersRepository } from "../../../modules/users/infrastructure/typeorm-users.repository.js";
import { UserRole } from "../../../modules/users/domain/user-role.js";
import { getAuthenticatedMatricula } from "../../../shared/auth/auth-context.js";
import { AppError } from "../../../shared/domain/errors/app-error.js";

export const loadActiveUser = (usersRepository: TypeOrmUsersRepository) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const matricula = getAuthenticatedMatricula(req);
    const user = await usersRepository.findActiveByMatricula(matricula);

    if (!user) {
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
