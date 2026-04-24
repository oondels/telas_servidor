import { Express, Router } from "express";
import { AppDataSource } from "../../database/data-source.js";
import {
  readSolicitacaoSchemaStatus,
  readTelasSchemaStatus,
} from "../../database/schema-manager.js";
import { asyncHandler } from "../middlewares/async-handler.js";
import { verifyToken } from "../middlewares/auth.js";
import { sendSuccess } from "../../../shared/http/http-response.js";
import { TypeOrmTelasRepository } from "../../../modules/telas/infrastructure/typeorm-telas.repository.js";
import { SearchTelasUseCase } from "../../../modules/telas/application/use-cases/search-telas.use-case.js";
import { CreateTelaUseCase } from "../../../modules/telas/application/use-cases/create-tela.use-case.js";
import { UpdatePosicaoTelasUseCase } from "../../../modules/telas/application/use-cases/update-posicao-telas.use-case.js";
import { UpdateStatusTelasUseCase } from "../../../modules/telas/application/use-cases/update-status-telas.use-case.js";
import { EditTelaUseCase } from "../../../modules/telas/application/use-cases/edit-tela.use-case.js";
import { TelasController } from "../../../modules/telas/presentation/http/telas.controller.js";
import { TypeOrmSolicitacoesRepository } from "../../../modules/solicitacoes/infrastructure/typeorm-solicitacoes.repository.js";
import { SearchSolicitacoesUseCase } from "../../../modules/solicitacoes/application/use-cases/search-solicitacoes.use-case.js";
import { GetSolicitacaoByIdUseCase } from "../../../modules/solicitacoes/application/use-cases/get-solicitacao-by-id.use-case.js";
import { CreateSolicitacaoUseCase } from "../../../modules/solicitacoes/application/use-cases/create-solicitacao.use-case.js";
import { AttendSolicitacaoUseCase } from "../../../modules/solicitacoes/application/use-cases/attend-solicitacao.use-case.js";
import { StartSolicitacaoUseCase } from "../../../modules/solicitacoes/application/use-cases/start-solicitacao.use-case.js";
import { CompleteSolicitacaoUseCase } from "../../../modules/solicitacoes/application/use-cases/complete-solicitacao.use-case.js";
import { DeliverSolicitacaoUseCase } from "../../../modules/solicitacoes/application/use-cases/deliver-solicitacao.use-case.js";
import { ReturnSolicitacaoUseCase } from "../../../modules/solicitacoes/application/use-cases/return-solicitacao.use-case.js";
import { SolicitacoesController } from "../../../modules/solicitacoes/presentation/http/solicitacoes.controller.js";

export const registerRoutes = (app: Express) => {
  const telasRepository = new TypeOrmTelasRepository(AppDataSource);
  const solicitacoesRepository = new TypeOrmSolicitacoesRepository(AppDataSource);

  const telasController = new TelasController(
    new SearchTelasUseCase(telasRepository),
    new CreateTelaUseCase(telasRepository),
    new UpdatePosicaoTelasUseCase(telasRepository),
    new UpdateStatusTelasUseCase(telasRepository),
    new EditTelaUseCase(telasRepository),
  );

  const solicitacoesController = new SolicitacoesController(
    new SearchSolicitacoesUseCase(solicitacoesRepository),
    new GetSolicitacaoByIdUseCase(solicitacoesRepository),
    new CreateSolicitacaoUseCase(solicitacoesRepository),
    new AttendSolicitacaoUseCase(solicitacoesRepository),
    new StartSolicitacaoUseCase(solicitacoesRepository),
    new CompleteSolicitacaoUseCase(solicitacoesRepository),
    new DeliverSolicitacaoUseCase(solicitacoesRepository),
    new ReturnSolicitacaoUseCase(solicitacoesRepository),
  );

  app.get("/", (_req, res) => {
    return sendSuccess(res, 200, { message: "Servidor de Telas ativo" });
  });

  app.get("/health", asyncHandler(async (_req, res) => {
    await AppDataSource.query("SELECT 1");
    const [schema, solicitacoesSchema] = await Promise.all([
      readTelasSchemaStatus(),
      readSolicitacaoSchemaStatus(),
    ]);

    return sendSuccess(res, 200, {
      message: "healthy",
      db: true,
      schema,
      solicitacoesSchema,
    });
  }));

  const protectedRouter = Router();
  protectedRouter.use(verifyToken);

  protectedRouter.get("/buscar-telas", asyncHandler(telasController.search));
  protectedRouter.post("/cadastrar-tela", asyncHandler(telasController.create));
  protectedRouter.put("/atualizar-posicao", asyncHandler(telasController.updatePosicao));
  protectedRouter.put("/atualizar-status", asyncHandler(telasController.updateStatus));
  protectedRouter.put("/editar-tela", asyncHandler(telasController.edit));

  protectedRouter.get("/solicitacoes-telas", asyncHandler(solicitacoesController.search));
  protectedRouter.get("/solicitacoes-telas/:id", asyncHandler(solicitacoesController.getById));
  protectedRouter.post("/solicitacoes-telas", asyncHandler(solicitacoesController.create));
  protectedRouter.put("/solicitacoes-telas/:id/attend", asyncHandler(solicitacoesController.attend));
  protectedRouter.put("/solicitacoes-telas/:id/start", asyncHandler(solicitacoesController.start));
  protectedRouter.put("/solicitacoes-telas/:id/complete", asyncHandler(solicitacoesController.complete));
  protectedRouter.put("/solicitacoes-telas/:id/deliver", asyncHandler(solicitacoesController.deliver));
  protectedRouter.put("/solicitacoes-telas/:id/return", asyncHandler(solicitacoesController.return));

  app.use(protectedRouter);
};
