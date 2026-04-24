import { Request, Response } from "express";
import {
  getAuthenticatedMatricula,
  getAuthenticatedUser,
} from "../../../../shared/auth/auth-context.js";
import { sendSuccess } from "../../../../shared/http/http-response.js";
import { normalizeDate } from "../../../../shared/utils/date.js";
import { parseMatricula, parsePositiveInt } from "../../../../shared/utils/parsers.js";
import { AttendSolicitacaoUseCase } from "../../application/use-cases/attend-solicitacao.use-case.js";
import { CompleteSolicitacaoUseCase } from "../../application/use-cases/complete-solicitacao.use-case.js";
import { CreateSolicitacaoUseCase } from "../../application/use-cases/create-solicitacao.use-case.js";
import { DeliverSolicitacaoUseCase } from "../../application/use-cases/deliver-solicitacao.use-case.js";
import { GetSolicitacaoByIdUseCase } from "../../application/use-cases/get-solicitacao-by-id.use-case.js";
import { ReturnSolicitacaoUseCase } from "../../application/use-cases/return-solicitacao.use-case.js";
import { SearchSolicitacoesUseCase } from "../../application/use-cases/search-solicitacoes.use-case.js";
import { StartSolicitacaoUseCase } from "../../application/use-cases/start-solicitacao.use-case.js";
import { normalizeSolicitacaoStatus } from "../../domain/solicitacao-status.js";

export class SolicitacoesController {
  constructor(
    private readonly searchSolicitacoesUseCase: SearchSolicitacoesUseCase,
    private readonly getSolicitacaoByIdUseCase: GetSolicitacaoByIdUseCase,
    private readonly createSolicitacaoUseCase: CreateSolicitacaoUseCase,
    private readonly attendSolicitacaoUseCase: AttendSolicitacaoUseCase,
    private readonly startSolicitacaoUseCase: StartSolicitacaoUseCase,
    private readonly completeSolicitacaoUseCase: CompleteSolicitacaoUseCase,
    private readonly deliverSolicitacaoUseCase: DeliverSolicitacaoUseCase,
    private readonly returnSolicitacaoUseCase: ReturnSolicitacaoUseCase,
  ) {}

  search = async (req: Request, res: Response) => {
    const result = await this.searchSolicitacoesUseCase.execute({
      status: req.query.status ? normalizeSolicitacaoStatus(req.query.status) : null,
      solicitante: parseMatricula(req.query.solicitante),
      search: String(req.query.search ?? ""),
      dateFrom: normalizeDate(req.query.dateFrom ?? req.query.dataInicial),
      dateTo: normalizeDate(req.query.dateTo ?? req.query.dataFinal),
      page: parsePositiveInt(req.query.page, 1, 1000000),
      itemsPerPage: parsePositiveInt(req.query.itemsPerPage, 10, 200),
    });

    return sendSuccess(res, 200, result);
  };

  getById = async (req: Request, res: Response) => {
    const solicitacao = await this.getSolicitacaoByIdUseCase.execute(String(req.params.id));
    return sendSuccess(res, 200, { solicitacao });
  };

  create = async (req: Request, res: Response) => {
    const solicitante = getAuthenticatedMatricula(req);
    const data = req.body ?? {};
    const items = Array.isArray(data?.dados_pedido?.items)
      ? data.dados_pedido.items
      : Array.isArray(data?.items)
        ? data.items
        : [];

    const solicitacao = await this.createSolicitacaoUseCase.execute({
      solicitante,
      items,
      motivo: String(data.motivo ?? "").trim() || null,
      observacaoPedido: String(data.observacao_pedido ?? data.observacaoPedido ?? "").trim() || null,
      turnoPedido: String(data.turno_pedido ?? data.turnoPedido ?? "").trim().toUpperCase() || null,
    });

    return sendSuccess(res, 201, {
      message: "success",
      solicitacao,
    });
  };

  attend = async (req: Request, res: Response) => {
    const updatedBy = getAuthenticatedMatricula(req);
    const data = req.body ?? {};
    const solicitacao = await this.attendSolicitacaoUseCase.execute(
      String(req.params.id),
      String(data.decision ?? data.status ?? ""),
      updatedBy,
      String(data.observacao_conferente ?? data.observacaoConferente ?? "").trim() || null,
    );

    return sendSuccess(res, 200, {
      message: "success",
      solicitacao,
    });
  };

  start = async (req: Request, res: Response) => {
    const updatedBy = getAuthenticatedMatricula(req);
    const user = getAuthenticatedUser(req);
    const usuarioCreate = String(user.usuario ?? user.matricula ?? "").trim().toUpperCase();
    const data = req.body ?? {};
    const solicitacao = await this.startSolicitacaoUseCase.execute(
      String(req.params.id),
      String(data.status ?? data.targetStatus ?? ""),
      updatedBy,
      usuarioCreate,
    );

    return sendSuccess(res, 200, {
      message: "success",
      solicitacao,
    });
  };

  complete = async (req: Request, res: Response) => {
    const updatedBy = getAuthenticatedMatricula(req);
    const solicitacao = await this.completeSolicitacaoUseCase.execute(String(req.params.id), updatedBy);

    return sendSuccess(res, 200, {
      message: "success",
      solicitacao,
    });
  };

  deliver = async (req: Request, res: Response) => {
    const updatedBy = getAuthenticatedMatricula(req);
    const data = req.body ?? {};
    const solicitacao = await this.deliverSolicitacaoUseCase.execute(
      String(req.params.id),
      updatedBy,
      parseMatricula(data.user_recebimento ?? data.userRecebimento) ?? 0,
      parseMatricula(data.user_conferente ?? data.userConferente) ?? 0,
    );

    return sendSuccess(res, 200, {
      message: "success",
      solicitacao,
    });
  };

  return = async (req: Request, res: Response) => {
    const updatedBy = getAuthenticatedMatricula(req);
    const data = req.body ?? {};
    const solicitacao = await this.returnSolicitacaoUseCase.execute(
      String(req.params.id),
      updatedBy,
      parseMatricula(data.user_recebimento ?? data.userRecebimento) ?? 0,
      parseMatricula(data.user_conferente ?? data.userConferente) ?? 0,
      String(data.observacao_conferente ?? data.observacaoConferente ?? "").trim(),
    );

    return sendSuccess(res, 200, {
      message: "success",
      solicitacao,
    });
  };
}
