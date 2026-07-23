import { Express, Router } from "express";
import { AppDataSource } from "../../../config/database.js";
import { TypeOrmAuditEventsRepository } from "../../../modules/audit/infrastructure/typeorm-audit-events.repository.js";
import { TypeOrmAppConfigRepository } from "../../../modules/config/infrastructure/typeorm-app-config.repository.js";
import { AttendSolicitacaoUseCase } from "../../../modules/solicitacoes/application/use-cases/attend-solicitacao.use-case.js";
import { CompleteSolicitacaoUseCase } from "../../../modules/solicitacoes/application/use-cases/complete-solicitacao.use-case.js";
import { CreateSolicitacaoUseCase } from "../../../modules/solicitacoes/application/use-cases/create-solicitacao.use-case.js";
import { DeliverSolicitacaoUseCase } from "../../../modules/solicitacoes/application/use-cases/deliver-solicitacao.use-case.js";
import { GetSolicitacaoByIdUseCase } from "../../../modules/solicitacoes/application/use-cases/get-solicitacao-by-id.use-case.js";
import { ReturnSolicitacaoUseCase } from "../../../modules/solicitacoes/application/use-cases/return-solicitacao.use-case.js";
import { SearchSolicitacoesUseCase } from "../../../modules/solicitacoes/application/use-cases/search-solicitacoes.use-case.js";
import { StartSolicitacaoUseCase } from "../../../modules/solicitacoes/application/use-cases/start-solicitacao.use-case.js";
import { normalizeSolicitacaoStatus } from "../../../modules/solicitacoes/domain/solicitacao-status.js";
import { TypeOrmSolicitacoesRepository } from "../../../modules/solicitacoes/infrastructure/typeorm-solicitacoes.repository.js";
import { CreateTelaUseCase } from "../../../modules/telas/application/use-cases/create-tela.use-case.js";
import { CreateTelasBatchUseCase } from "../../../modules/telas/application/use-cases/create-telas-batch.use-case.js";
import { EditTelaUseCase } from "../../../modules/telas/application/use-cases/edit-tela.use-case.js";
import { SearchTelasUseCase } from "../../../modules/telas/application/use-cases/search-telas.use-case.js";
import { UpdateStatusTelasUseCase } from "../../../modules/telas/application/use-cases/update-status-telas.use-case.js";
import { RemoveTelaEnderecoUseCase } from "../../../modules/telas/application/use-cases/remove-tela-endereco.use-case.js";
import { DeleteTelaUseCase } from "../../../modules/telas/application/use-cases/delete-tela.use-case.js";
import { CreateTelaEnderecoUseCase } from "../../../modules/telas/application/use-cases/create-tela-endereco.use-case.js";
import { ListTelasEnderecosUseCase } from "../../../modules/telas/application/use-cases/list-telas-enderecos.use-case.js";
import { BatchEnderecarTelasUseCase } from "../../../modules/telas/application/use-cases/batch-enderecar-telas.use-case.js";
import { ClearTelaEnderecoUseCase } from "../../../modules/telas/application/use-cases/clear-tela-endereco.use-case.js";
import { TypeOrmTelasRepository } from "../../../modules/telas/infrastructure/typeorm-telas.repository.js";
import { TypeOrmTelasEnderecosRepository } from "../../../modules/telas/infrastructure/typeorm-telas-enderecos.repository.js";
import { normalizeUserRole, USER_ROLES } from "../../../modules/users/domain/user-role.js";
import { TypeOrmUsersRepository } from "../../../modules/users/infrastructure/typeorm-users.repository.js";
import { getActiveAppUser, getAuthenticatedMatricula, getAuthenticatedUser } from "../../../shared/auth/auth-context.js";
import { AppError } from "../../../shared/domain/errors/app-error.js";
import { sendSuccess } from "../../../shared/http/http-response.js";
import { normalizeDate } from "../../../shared/utils/date.js";
import { parseMatricula, parsePositiveInt } from "../../../shared/utils/parsers.js";
import { asyncHandler } from "../middlewares/async-handler.js";
import { loadActiveUser, requireRoles } from "../middlewares/active-user.js";
import { verifyToken } from "../middlewares/auth.js";

const parseBooleanQuery = (value: unknown): boolean | null => {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "sim", "ativo"].includes(normalized)) return true;
  if (["false", "0", "nao", "não", "inativo"].includes(normalized)) return false;
  return null;
};

const getActorUsuario = (req: Parameters<typeof getAuthenticatedUser>[0]) => {
  const jwtUser = getAuthenticatedUser(req);
  return String(jwtUser.usuario ?? jwtUser.matricula ?? "").trim().toUpperCase();
};

export const registerRoutes = (app: Express) => {
  const telasRepository = new TypeOrmTelasRepository(AppDataSource);
  const solicitacoesRepository = new TypeOrmSolicitacoesRepository(AppDataSource);
  const usersRepository = new TypeOrmUsersRepository(AppDataSource);
  const auditRepository = new TypeOrmAuditEventsRepository(AppDataSource);
  const configRepository = new TypeOrmAppConfigRepository(AppDataSource);
  const telasEnderecosRepository = new TypeOrmTelasEnderecosRepository(AppDataSource);

  const searchTelasUseCase = new SearchTelasUseCase(telasRepository);
  const createTelaUseCase = new CreateTelaUseCase(telasRepository);
  const createTelasBatchUseCase = new CreateTelasBatchUseCase(telasRepository);
  const updateStatusTelasUseCase = new UpdateStatusTelasUseCase(telasRepository);
  const removeTelaEnderecoUseCase = new RemoveTelaEnderecoUseCase(telasRepository);
  const deleteTelaUseCase = new DeleteTelaUseCase(telasRepository);
  const editTelaUseCase = new EditTelaUseCase(telasRepository);
  const createTelaEnderecoUseCase = new CreateTelaEnderecoUseCase(telasEnderecosRepository);
  const listTelasEnderecosUseCase = new ListTelasEnderecosUseCase(telasEnderecosRepository);
  const batchEnderecarTelasUseCase = new BatchEnderecarTelasUseCase(telasEnderecosRepository);
  const clearTelaEnderecoUseCase = new ClearTelaEnderecoUseCase(telasEnderecosRepository);

  const searchSolicitacoesUseCase = new SearchSolicitacoesUseCase(solicitacoesRepository);
  const getSolicitacaoByIdUseCase = new GetSolicitacaoByIdUseCase(solicitacoesRepository);
  const createSolicitacaoUseCase = new CreateSolicitacaoUseCase(solicitacoesRepository, telasRepository, configRepository);
  const attendSolicitacaoUseCase = new AttendSolicitacaoUseCase(solicitacoesRepository);
  const startSolicitacaoUseCase = new StartSolicitacaoUseCase(solicitacoesRepository);
  const completeSolicitacaoUseCase = new CompleteSolicitacaoUseCase(solicitacoesRepository);
  const deliverSolicitacaoUseCase = new DeliverSolicitacaoUseCase(solicitacoesRepository);
  const returnSolicitacaoUseCase = new ReturnSolicitacaoUseCase(solicitacoesRepository);

  app.get("/", (_req, res) => {
    return sendSuccess(res, 200, { message: "Servidor de Telas ativo" });
  });

  app.get("/health", asyncHandler(async (_req, res) => {
    await AppDataSource.query("SELECT 1");
    return sendSuccess(res, 200, { message: "healthy", db: true });
  }));

  const v1 = Router();
  v1.use(verifyToken);
  v1.use(loadActiveUser(usersRepository));

  v1.get("/me", asyncHandler(async (req, res) => {
    return sendSuccess(res, 200, {
      user: getActiveAppUser(req),
      token: getAuthenticatedUser(req),
    });
  }));

  v1.get("/users", requireRoles(USER_ROLES.ADMIN), asyncHandler(async (req, res) => {
    const role = normalizeUserRole(req.query.role);
    const result = await usersRepository.search({
      search: String(req.query.search ?? ""),
      role,
      active: parseBooleanQuery(req.query.active),
      page: parsePositiveInt(req.query.page, 1, 1000000),
      itemsPerPage: parsePositiveInt(req.query.itemsPerPage, 10, 200),
    });

    return sendSuccess(res, 200, result);
  }));

  v1.post("/users", requireRoles(USER_ROLES.ADMIN), asyncHandler(async (req, res) => {
    const role = normalizeUserRole(req.body?.role);
    if (!role) throw new AppError(400, "PAPEL_INVALIDO", "Papel de usuário inválido");

    const user = await usersRepository.create({
      matricula: parseMatricula(req.body?.matricula) ?? 0,
      nome: req.body?.nome,
      usuario: req.body?.usuario,
      setor: req.body?.setor,
      unidade: req.body?.unidade,
      role,
      active: req.body?.active,
    });

    await auditRepository.create({
      entityType: "USUARIO",
      entityId: String(user.matricula),
      action: "USUARIO_CRIADO",
      actorMatricula: getAuthenticatedMatricula(req),
      afterState: user as unknown as Record<string, unknown>,
    });

    return sendSuccess(res, 201, { message: "success", user });
  }));

  v1.patch("/users/:id", requireRoles(USER_ROLES.ADMIN), asyncHandler(async (req, res) => {
    const user = await usersRepository.update(String(req.params.id), {
      matricula: req.body?.matricula !== undefined ? parseMatricula(req.body.matricula) ?? 0 : undefined,
      nome: req.body?.nome,
      usuario: req.body?.usuario,
      setor: req.body?.setor,
      unidade: req.body?.unidade,
      role: req.body?.role,
      active: req.body?.active,
    });

    await auditRepository.create({
      entityType: "USUARIO",
      entityId: String(user.matricula),
      action: "USUARIO_ATUALIZADO",
      actorMatricula: getAuthenticatedMatricula(req),
      afterState: user as unknown as Record<string, unknown>,
    });

    return sendSuccess(res, 200, { message: "success", user });
  }));

  v1.get("/telas", asyncHandler(async (req, res) => {
    const result = await searchTelasUseCase.execute({
      letra: req.query.letra as string | undefined,
      modelo: req.query.modelo as string | undefined,
      status: req.query.status as string | undefined,
      endereco: req.query.endereco as string | undefined,
      search: req.query.search as string | undefined,
      page: parsePositiveInt(req.query.page, 1, 1000000),
      itemsPerPage: parsePositiveInt(req.query.itemsPerPage, 10, 200),
    });

    return sendSuccess(res, 200, result);
  }));

  v1.get("/telas/sem-movimentacao", asyncHandler(async (req, res) => {
    const config = await configRepository.getInactiveTelasConfig();
    const days = parsePositiveInt(req.query.days, config.days, 3650);
    const result = await telasRepository.searchInactive({
      days,
      page: parsePositiveInt(req.query.page, 1, 1000000),
      itemsPerPage: parsePositiveInt(req.query.itemsPerPage, 10, 200),
    });

    return sendSuccess(res, 200, { days, ...result });
  }));

  v1.post(
    "/telas",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS),
    asyncHandler(async (req, res) => {
      const tela = await createTelaUseCase.execute(req.body ?? {}, getActorUsuario(req));
      return sendSuccess(res, 201, { message: "success", tela });
    }),
  );

  v1.post(
    "/telas/lote",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS),
    asyncHandler(async (req, res) => {
      const telas = await createTelasBatchUseCase.execute(req.body ?? {}, getActorUsuario(req));
      return sendSuccess(res, 201, { message: "success", telas });
    }),
  );

  v1.patch(
    "/telas/batch-endereco",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS, USER_ROLES.MOVIMENTADOR),
    asyncHandler(async (req, res) => {
      const result = await batchEnderecarTelasUseCase.execute({
        barcodeEndereco: req.body?.endereco,
        codigosTelas: req.body?.telas,
        usuario: getActorUsuario(req),
      });
      return sendSuccess(res, 200, { message: "success", ...result });
    }),
  );

  v1.post(
    "/enderecos/:id/limpar",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS),
    asyncHandler(async (req, res) => {
      const result = await clearTelaEnderecoUseCase.execute(Number(req.params.id), getActorUsuario(req));
      return sendSuccess(res, 200, { message: "success", ...result });
    }),
  );

  v1.patch(
    "/telas/:codigo",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS),
    asyncHandler(async (req, res) => {
      const tela = await editTelaUseCase.execute(String(req.params.codigo).trim().toUpperCase(), req.body ?? {}, getActorUsuario(req));
      return sendSuccess(res, 200, { message: "success", tela });
    }),
  );

  v1.patch(
    "/telas/:codigo/endereco",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS, USER_ROLES.MOVIMENTADOR),
    asyncHandler(async (req, res) => {
      const result = await batchEnderecarTelasUseCase.execute({
        barcodeEndereco: req.body?.endereco,
        codigosTelas: [String(req.params.codigo).trim().toUpperCase()],
        usuario: getActorUsuario(req),
      });
      return sendSuccess(res, 200, { message: "success", ...result });
    }),
  );

  v1.patch(
    "/telas/:codigo/status",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS),
    asyncHandler(async (req, res) => {
      const result = await updateStatusTelasUseCase.execute(
        String(req.params.codigo).trim().toUpperCase(),
        req.body?.status,
        getActorUsuario(req),
      );
      return sendSuccess(res, 200, { message: "success", ...result });
    }),
  );

  v1.delete(
    "/telas/:codigo/endereco",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.MOVIMENTADOR),
    asyncHandler(async (req, res) => {
      const tela = await removeTelaEnderecoUseCase.execute(
        String(req.params.codigo),
        getActorUsuario(req),
      );
      return sendSuccess(res, 200, { message: "success", tela });
    }),
  );

  v1.delete(
    "/telas/:codigo",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.MOVIMENTADOR),
    asyncHandler(async (req, res) => {
      const tela = await deleteTelaUseCase.execute(
        String(req.params.codigo),
        getActorUsuario(req),
      );
      return sendSuccess(res, 200, { message: "success", tela });
    }),
  );

  v1.post(
    "/telas/match",
    requireRoles(USER_ROLES.ADMIN),
    asyncHandler(async (req, res) => {
      const marca = String(req.body?.marca ?? "").trim().toUpperCase();
      const modelo = String(req.body?.modelo ?? "").trim().toUpperCase();
      const numero = String(req.body?.numero ?? "").trim().toUpperCase();
      const pecas = Array.isArray(req.body?.pecas) ? req.body.pecas : [];
      const fios = req.body?.fios !== undefined ? String(req.body.fios).trim().toUpperCase() : undefined;

      if (!marca || !modelo || !numero) {
        throw new AppError(400, "DADOS_OBRIGATORIOS", "Informe marca, modelo e numero para a busca.");
      }

      const matches = await telasRepository.findStrictMatch({ marca, modelo, numero, pecas, fios });
      return sendSuccess(res, 200, { matches, total: matches.length });
    }),
  );

  v1.get(
    "/enderecos",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS, USER_ROLES.MOVIMENTADOR),
    asyncHandler(async (req, res) => {
      const result = await listTelasEnderecosUseCase.execute();
      return sendSuccess(res, 200, { message: "success", addresses: result });
    }),
  );

  v1.post(
    "/enderecos",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS),
    asyncHandler(async (req, res) => {
      const result = await createTelaEnderecoUseCase.execute(req.body ?? {}, getActorUsuario(req));
      return sendSuccess(res, 201, { message: "success", address: result });
    }),
  );

  v1.get(
    "/enderecos/:barcode",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS, USER_ROLES.MOVIMENTADOR),
    asyncHandler(async (req, res) => {
      const barcode = String(req.params.barcode).trim().toUpperCase();
      const address = await telasEnderecosRepository.findByBarcode(barcode);
      if (!address) {
        throw new AppError(404, "ENDERECO_NAO_ENCONTRADO", "Endereço não encontrado.");
      }
      const ocupadas = await telasEnderecosRepository.countOccupiedVagas(address.address);
      return sendSuccess(res, 200, {
        message: "success",
        address: { ...address, ocupadas },
      });
    }),
  );

  v1.patch(
    "/enderecos/:id/vagas",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      const vagas = Number(req.body?.vagas);
      const result = await telasEnderecosRepository.updateVagas(id, vagas, getActorUsuario(req));
      return sendSuccess(res, 200, { message: "success", address: result });
    }),
  );

  v1.delete(
    "/enderecos/:id",
    requireRoles(USER_ROLES.ADMIN),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      await telasEnderecosRepository.delete(id);
      return sendSuccess(res, 200, { message: "success" });
    }),
  );



  v1.post(
    "/telas/:codigo/reposicoes",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS),
    asyncHandler(async (req, res) => {
      const tela = await telasRepository.replaceByBarcode(
        String(req.params.codigo).trim().toUpperCase(),
        req.body ?? {},
        getActorUsuario(req),
      );
      if (!tela) throw new AppError(404, "TELA_NAO_ENCONTRADA", "Tela não encontrada para reposição");
      return sendSuccess(res, 200, { message: "success", tela });
    }),
  );

  v1.get("/solicitacoes", asyncHandler(async (req, res) => {
    const result = await searchSolicitacoesUseCase.execute({
      status: req.query.status ? normalizeSolicitacaoStatus(req.query.status) : null,
      solicitante: parseMatricula(req.query.solicitante),
      search: String(req.query.search ?? ""),
      dateFrom: normalizeDate(req.query.dateFrom ?? req.query.dataInicial),
      dateTo: normalizeDate(req.query.dateTo ?? req.query.dataFinal),
      page: parsePositiveInt(req.query.page, 1, 1000000),
      itemsPerPage: parsePositiveInt(req.query.itemsPerPage, 10, 200),
    });

    return sendSuccess(res, 200, result);
  }));

  v1.get("/solicitacoes/:id", asyncHandler(async (req, res) => {
    const solicitacao = await getSolicitacaoByIdUseCase.execute(String(req.params.id));
    return sendSuccess(res, 200, { solicitacao });
  }));

  v1.post("/solicitacoes", asyncHandler(async (req, res) => {
    const data = req.body ?? {};
    const items = Array.isArray(data?.dados_pedido?.items)
      ? data.dados_pedido.items
      : Array.isArray(data?.items)
        ? data.items
        : [];

    const solicitacao = await createSolicitacaoUseCase.execute({
      solicitante: getAuthenticatedMatricula(req),
      items,
      tipo: String(data.tipo ?? "").trim().toUpperCase() || undefined,
      motivo: String(data.motivo ?? "").trim() || null,
      observacaoPedido: String(data.observacao_pedido ?? data.observacaoPedido ?? "").trim() || null,
      turnoPedido: String(data.turno_pedido ?? data.turnoPedido ?? "").trim().toUpperCase() || null,
    });

    return sendSuccess(res, 201, { message: "success", solicitacao });
  }));

  v1.patch(
    "/solicitacoes/:id/atendimento",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS, USER_ROLES.MOVIMENTADOR),
    asyncHandler(async (req, res) => {
      const solicitacao = await attendSolicitacaoUseCase.execute(
        String(req.params.id),
        String(req.body?.decision ?? req.body?.status ?? ""),
        getAuthenticatedMatricula(req),
        String(req.body?.observacao_conferente ?? req.body?.observacaoConferente ?? "").trim() || null,
      );
      return sendSuccess(res, 200, { message: "success", solicitacao });
    }),
  );

  v1.patch(
    "/solicitacoes/:id/inicio",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS, USER_ROLES.MOVIMENTADOR),
    asyncHandler(async (req, res) => {
      const solicitacao = await startSolicitacaoUseCase.execute(
        String(req.params.id),
        String(req.body?.status ?? req.body?.targetStatus ?? ""),
        getAuthenticatedMatricula(req),
        getActorUsuario(req),
      );
      return sendSuccess(res, 200, { message: "success", solicitacao });
    }),
  );

  v1.patch(
    "/solicitacoes/:id/conclusao",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS, USER_ROLES.MOVIMENTADOR),
    asyncHandler(async (req, res) => {
      const solicitacao = await completeSolicitacaoUseCase.execute(String(req.params.id), getAuthenticatedMatricula(req));
      return sendSuccess(res, 200, { message: "success", solicitacao });
    }),
  );

  v1.patch(
    "/solicitacoes/:id/entrega",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS, USER_ROLES.MOVIMENTADOR),
    asyncHandler(async (req, res) => {
      const solicitacao = await deliverSolicitacaoUseCase.execute(
        String(req.params.id),
        getAuthenticatedMatricula(req),
        parseMatricula(req.body?.user_recebimento ?? req.body?.userRecebimento) ?? 0,
        parseMatricula(req.body?.user_conferente ?? req.body?.userConferente) ?? 0,
      );
      return sendSuccess(res, 200, { message: "success", solicitacao });
    }),
  );

  v1.patch(
    "/solicitacoes/:id/devolucao",
    requireRoles(USER_ROLES.ADMIN, USER_ROLES.OPERADOR_TELAS, USER_ROLES.MOVIMENTADOR),
    asyncHandler(async (req, res) => {
      const solicitacao = await returnSolicitacaoUseCase.execute(
        String(req.params.id),
        getAuthenticatedMatricula(req),
        parseMatricula(req.body?.user_recebimento ?? req.body?.userRecebimento) ?? 0,
        parseMatricula(req.body?.user_conferente ?? req.body?.userConferente) ?? 0,
        String(req.body?.observacao_conferente ?? req.body?.observacaoConferente ?? "").trim(),
      );
      return sendSuccess(res, 200, { message: "success", solicitacao });
    }),
  );

  v1.get("/config/telas-sem-movimentacao", asyncHandler(async (_req, res) => {
    return sendSuccess(res, 200, { config: await configRepository.getInactiveTelasConfig() });
  }));

  v1.patch(
    "/config/telas-sem-movimentacao",
    requireRoles(USER_ROLES.ADMIN),
    asyncHandler(async (req, res) => {
      const config = await configRepository.updateInactiveTelasConfig(Number(req.body?.days), getAuthenticatedMatricula(req));
      return sendSuccess(res, 200, { message: "success", config });
    }),
  );

  v1.get("/config/auto-cadastro-telas", asyncHandler(async (_req, res) => {
    return sendSuccess(res, 200, { config: await configRepository.getAutoCadastroConfig() });
  }));

  v1.patch(
    "/config/auto-cadastro-telas",
    requireRoles(USER_ROLES.ADMIN),
    asyncHandler(async (req, res) => {
      const config = await configRepository.updateAutoCadastroConfig(Boolean(req.body?.enabled), getAuthenticatedMatricula(req));
      return sendSuccess(res, 200, { message: "success", config });
    }),
  );

  v1.get("/audit-events", requireRoles(USER_ROLES.ADMIN), asyncHandler(async (req, res) => {
    const result = await auditRepository.search({
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId as string | undefined,
      action: req.query.action as string | undefined,
      actorMatricula: parseMatricula(req.query.actorMatricula),
      page: parsePositiveInt(req.query.page, 1, 1000000),
      itemsPerPage: parsePositiveInt(req.query.itemsPerPage, 10, 200),
    });

    return sendSuccess(res, 200, result);
  }));

  app.use("/v1", v1);
};
