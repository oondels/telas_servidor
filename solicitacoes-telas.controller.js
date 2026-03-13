import { Router } from "express";
import {
  SolicitacaoFlowError,
  attendSolicitacao,
  completeSolicitacao,
  deliverSolicitacao,
  returnSolicitacao,
  startSolicitacao,
} from "./solicitacoes-telas.service.js";

const parseMatriculaPayload = (parseMatricula, rawValue) => parseMatricula(rawValue);

const resolveUpdatedBy = (req, data, resolveUsuario, parseMatricula) => {
  const usuario = resolveUsuario(req, data);
  return parseMatricula(usuario);
};

const handleUnexpectedError = (req, res, error, sendError, logEvent, fallbackCode, fallbackMessage) => {
  if (error instanceof SolicitacaoFlowError) {
    return sendError(res, error.statusCode, error.code, error.message, error.details);
  }

  if (error && typeof error === "object" && "statusCode" in error && "code" in error && "message" in error) {
    return sendError(res, error.statusCode, error.code, error.message, error.details ?? null);
  }

  logEvent("error", fallbackCode, {
    requestId: req.requestId,
    error: error.message,
  });

  return sendError(res, 500, fallbackCode, fallbackMessage, {
    reason: error.message,
  });
};

export const createSolicitacoesTelasRouter = ({
  pool,
  resolveUsuario,
  parseMatricula,
  sendSuccess,
  sendError,
  logEvent,
}) => {
  const router = Router();

  /**
   * PUT /solicitacoes-telas/:id/attend
   * Registra a decisão inicial do pedido (aceito ou recusado).
   * Atualiza no banco: `status`, `observacao_conferente` (quando informado),
   * `user_conferente` (quando há observação), `updated_at` e `updated_by`.
   */
  router.put("/:id/attend", async (req, res) => {
    try {
      const data = req.body || {};
      const updatedBy = resolveUpdatedBy(req, data, resolveUsuario, parseMatricula);
      if (!updatedBy) {
        return sendError(res, 400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
      }

      const decision = data.decision ?? data.status;
      const observacaoConferente = String(data.observacao_conferente ?? data.observacaoConferente ?? "")
        .trim() || null;

      const solicitacao = await attendSolicitacao({
        pool,
        id: req.params.id,
        decision,
        updatedBy,
        observacaoConferente,
      });

      return sendSuccess(res, 200, {
        message: "success",
        solicitacao,
      });
    } catch (error) {
      return handleUnexpectedError(
        req,
        res,
        error,
        sendError,
        logEvent,
        "SOLICITACAO_ATTEND_FAILED",
        "Erro ao atender solicitação",
      );
    }
  });

  /**
   * PUT /solicitacoes-telas/:id/start
   * Inicia o atendimento da solicitação após aceite.
   * O payload deve informar `status` com `gravacao` ou `setor_em_manutencao`.
   * Atualiza no banco: `status`, `updated_at` e `updated_by`.
   */
  router.put("/:id/start", async (req, res) => {
    try {
      const data = req.body || {};
      const usuarioLogado = String(data.usuariocreate ?? resolveUsuario(req, data) ?? "")
        .trim()
        .toUpperCase();
      const updatedBy = parseMatricula(data.usuario ?? resolveUsuario(req, data));
      if (!updatedBy) {
        return sendError(res, 400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
      }

      const targetStatus = data.status ?? data.targetStatus;
      const solicitacao = await startSolicitacao({
        pool,
        id: req.params.id,
        targetStatus,
        updatedBy,
        usuarioCreate: usuarioLogado,
      });

      return sendSuccess(res, 200, {
        message: "success",
        solicitacao,
      });
    } catch (error) {
      return handleUnexpectedError(
        req,
        res,
        error,
        sendError,
        logEvent,
        "SOLICITACAO_START_FAILED",
        "Erro ao iniciar solicitação",
      );
    }
  });

  /**
   * PUT /solicitacoes-telas/:id/complete
   * Conclui a solicitação e marca como pronta para retirada.
   * Atualiza no banco: `status = concluido`, `updated_at` e `updated_by`.
   */
  router.put("/:id/complete", async (req, res) => {
    try {
      const data = req.body || {};
      const updatedBy = resolveUpdatedBy(req, data, resolveUsuario, parseMatricula);
      if (!updatedBy) {
        return sendError(res, 400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
      }

      const solicitacao = await completeSolicitacao({
        pool,
        id: req.params.id,
        updatedBy,
      });

      return sendSuccess(res, 200, {
        message: "success",
        solicitacao,
      });
    } catch (error) {
      return handleUnexpectedError(
        req,
        res,
        error,
        sendError,
        logEvent,
        "SOLICITACAO_COMPLETE_FAILED",
        "Erro ao concluir solicitação",
      );
    }
  });

  /**
   * PUT /solicitacoes-telas/:id/deliver
   * Registra a retirada física da tela.
   * Payload obrigatório: `user_recebimento` e `user_conferente`.
   * Atualiza no banco: `status = entregue`, `entregue = true`, `data_entrega`,
   * `user_recebimento`, `user_conferente`, `updated_at` e `updated_by`.
   */
  router.put("/:id/deliver", async (req, res) => {
    try {
      const data = req.body || {};
      const updatedBy = resolveUpdatedBy(req, data, resolveUsuario, parseMatricula);
      if (!updatedBy) {
        return sendError(res, 400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
      }

      const userRecebimento = parseMatriculaPayload(
        parseMatricula,
        data.user_recebimento ?? data.userRecebimento,
      );
      const userConferente = parseMatriculaPayload(
        parseMatricula,
        data.user_conferente ?? data.userConferente,
      );

      if (!userRecebimento || !userConferente) {
        return sendError(
          res,
          400,
          "DADOS_ENTREGA_INVALIDOS",
          "Informe user_recebimento e user_conferente válidos",
        );
      }

      if (userConferente !== updatedBy) {
        return sendError(
          res,
          403,
          "CONFERENTE_INVALIDO",
          "user_conferente deve ser a matrícula do usuário autenticado",
        );
      }

      const solicitacao = await deliverSolicitacao({
        pool,
        id: req.params.id,
        updatedBy,
        userRecebimento,
        userConferente,
      });

      return sendSuccess(res, 200, {
        message: "success",
        solicitacao,
      });
    } catch (error) {
      return handleUnexpectedError(
        req,
        res,
        error,
        sendError,
        logEvent,
        "SOLICITACAO_DELIVER_FAILED",
        "Erro ao registrar entrega da solicitação",
      );
    }
  });

  /**
   * PUT /solicitacoes-telas/:id/return
   * Registra a devolução da tela após entrega.
   * Payload obrigatório: `user_recebimento`, `user_conferente` e `observacao_conferente`.
   * Atualiza no banco: `status = devolvido`, `entregue = false`, `user_recebimento`,
   * `user_conferente`, `observacao_conferente`, `updated_at` e `updated_by`.
   */
  router.put("/:id/return", async (req, res) => {
    try {
      const data = req.body || {};
      const updatedBy = resolveUpdatedBy(req, data, resolveUsuario, parseMatricula);
      if (!updatedBy) {
        return sendError(res, 400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
      }

      const userRecebimento = parseMatriculaPayload(
        parseMatricula,
        data.user_recebimento ?? data.userRecebimento,
      );
      const userConferente = parseMatriculaPayload(
        parseMatricula,
        data.user_conferente ?? data.userConferente,
      );
      const observacaoConferente = String(data.observacao_conferente ?? data.observacaoConferente ?? "")
        .trim();

      if (!userRecebimento || !userConferente) {
        return sendError(
          res,
          400,
          "DADOS_DEVOLUCAO_INVALIDOS",
          "Informe user_recebimento e user_conferente válidos",
        );
      }

      if (!observacaoConferente) {
        return sendError(
          res,
          400,
          "OBSERVACAO_OBRIGATORIA",
          "Informe observacao_conferente para registrar a devolução",
        );
      }

      if (userConferente !== updatedBy) {
        return sendError(
          res,
          403,
          "CONFERENTE_INVALIDO",
          "user_conferente deve ser a matrícula do usuário autenticado",
        );
      }

      const solicitacao = await returnSolicitacao({
        pool,
        id: req.params.id,
        updatedBy,
        userRecebimento,
        userConferente,
        observacaoConferente,
      });

      return sendSuccess(res, 200, {
        message: "success",
        solicitacao,
      });
    } catch (error) {
      return handleUnexpectedError(
        req,
        res,
        error,
        sendError,
        logEvent,
        "SOLICITACAO_RETURN_FAILED",
        "Erro ao registrar devolução da solicitação",
      );
    }
  });

  return router;
};
