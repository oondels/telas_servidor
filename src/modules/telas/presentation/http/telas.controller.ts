import { Request, Response } from "express";
import { sendSuccess } from "../../../../shared/http/http-response.js";
import { getAuthenticatedUser } from "../../../../shared/auth/auth-context.js";
import { SearchTelasUseCase } from "../../application/use-cases/search-telas.use-case.js";
import { CreateTelaUseCase } from "../../application/use-cases/create-tela.use-case.js";
import { UpdatePosicaoTelasUseCase } from "../../application/use-cases/update-posicao-telas.use-case.js";
import { UpdateStatusTelasUseCase } from "../../application/use-cases/update-status-telas.use-case.js";
import { EditTelaUseCase } from "../../application/use-cases/edit-tela.use-case.js";
import { parsePositiveInt } from "../../../../shared/utils/parsers.js";

export class TelasController {
  constructor(
    private readonly searchTelasUseCase: SearchTelasUseCase,
    private readonly createTelaUseCase: CreateTelaUseCase,
    private readonly updatePosicaoTelasUseCase: UpdatePosicaoTelasUseCase,
    private readonly updateStatusTelasUseCase: UpdateStatusTelasUseCase,
    private readonly editTelaUseCase: EditTelaUseCase,
  ) {}

  search = async (req: Request, res: Response) => {
    const result = await this.searchTelasUseCase.execute({
      letra: req.query.letra as string | undefined,
      modelo: req.query.modelo as string | undefined,
      status: req.query.status as string | undefined,
      endereco: req.query.endereco as string | undefined,
      search: req.query.search as string | undefined,
      page: parsePositiveInt(req.query.page, 1, 1000000),
      itemsPerPage: parsePositiveInt(req.query.itemsPerPage, 10, 200),
    });

    return sendSuccess(res, 200, result);
  };

  create = async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const usuario = String(user.usuario ?? user.matricula ?? "").trim().toUpperCase();
    const tela = await this.createTelaUseCase.execute(req.body ?? {}, usuario);

    return sendSuccess(res, 201, {
      message: "success",
      id: tela.id,
      tela,
    });
  };

  updatePosicao = async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const usuario = String(user.usuario ?? user.matricula ?? "").trim().toUpperCase();
    const result = await this.updatePosicaoTelasUseCase.execute(
      req.body?.telas,
      req.body?.endereco,
      usuario,
    );

    return sendSuccess(res, 200, {
      message: "success",
      ...result,
    });
  };

  updateStatus = async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const usuario = String(user.usuario ?? user.matricula ?? "").trim().toUpperCase();
    const result = await this.updateStatusTelasUseCase.execute(
      req.body?.telas,
      req.body?.status,
      usuario,
    );

    return sendSuccess(res, 200, {
      message: "success",
      ...result,
    });
  };

  edit = async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const usuario = String(user.usuario ?? user.matricula ?? "").trim().toUpperCase();
    const codbarrastela = String(req.body?.codbarrastela ?? req.body?.codBarrasTela ?? "")
      .trim()
      .toUpperCase();
    const tela = await this.editTelaUseCase.execute(codbarrastela, req.body ?? {}, usuario);

    return sendSuccess(res, 200, {
      message: "success",
      tela,
    });
  };
}
