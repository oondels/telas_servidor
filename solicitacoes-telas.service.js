import { cadastrarTelaService } from "./telas-cadastro.service.js";

const SOLICITACAO_TABLE_NAME = "fabrica.solicitacao_tela";

const STATUS = Object.freeze({
  PENDENTE: "pedido",
  ACEITO: "aceito",
  REPROVADO: "reprovado",
  GRAVACAO: "gravacao",
  SETOR_EM_MANUTENCAO: "setor_em_manutencao",
  CONCLUIDO: "concluido",
  ENTREGUE: "entregue",
  DEVOLVIDO: "devolvido",
});

const toSqlDateTime = () => new Date().toISOString().slice(0, 19).replace("T", " ");

const normalizeCurrentStatus = (rawStatus) => {
  const normalized = String(rawStatus ?? "")
    .trim()
    .toLowerCase();

  return normalized || STATUS.PENDENTE;
};

export const normalizeAttendDecision = (rawDecision) => {
  const normalized = String(rawDecision ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "recusado") return STATUS.REPROVADO;
  return normalized;
};

export const normalizeStartStatus = (rawStatus) => {
  return String(rawStatus ?? "")
    .trim()
    .toLowerCase();
};

export class SolicitacaoFlowError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = "SolicitacaoFlowError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const createTransitionError = (currentStatus, expectedCurrentStatus, nextStatus) => {
  const expected = Array.isArray(expectedCurrentStatus)
    ? expectedCurrentStatus
    : [expectedCurrentStatus];

  return new SolicitacaoFlowError(
    409,
    "TRANSICAO_STATUS_INVALIDA",
    "Transição de status não permitida",
    {
      atual: currentStatus,
      esperado: expected,
      proximo: nextStatus,
    },
  );
};

const rollbackSafely = async (client, started) => {
  if (!started) return;

  try {
    await client.query("ROLLBACK");
  } catch {
    // noop
  }
};

const runInTransaction = async (pool, callback) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const result = await callback(client);

    await client.query("COMMIT");
    transactionStarted = false;

    return result;
  } catch (error) {
    await rollbackSafely(client, transactionStarted);
    throw error;
  } finally {
    client.release();
  }
};

const fetchSolicitacaoForUpdate = async (client, id) => {
  const result = await client.query(
    `SELECT id, status, dados_pedido
     FROM ${SOLICITACAO_TABLE_NAME}
     WHERE id = $1
     FOR UPDATE`,
    [id],
  );

  if (result.rowCount === 0) {
    throw new SolicitacaoFlowError(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada");
  }

  return result.rows[0];
};

export const attendSolicitacao = async ({
  pool,
  id,
  decision,
  updatedBy,
  observacaoConferente,
}) => {
  const normalizedDecision = normalizeAttendDecision(decision);
  if (normalizedDecision !== STATUS.ACEITO && normalizedDecision !== STATUS.REPROVADO) {
    throw new SolicitacaoFlowError(
      400,
      "DECISAO_INVALIDA",
      "Decisão inválida para atendimento. Utilize aceito ou recusado.",
    );
  }

  return runInTransaction(pool, async (client) => {
    const currentRow = await fetchSolicitacaoForUpdate(client, id);
    const currentStatus = normalizeCurrentStatus(currentRow.status);

    const canAttendFromPedido = currentStatus === STATUS.PENDENTE
      && (normalizedDecision === STATUS.ACEITO || normalizedDecision === STATUS.REPROVADO);
    const canCancelFromManutencao = currentStatus === STATUS.SETOR_EM_MANUTENCAO
      && normalizedDecision === STATUS.REPROVADO;

    if (!canAttendFromPedido && !canCancelFromManutencao) {
      throw createTransitionError(
        currentStatus,
        [STATUS.PENDENTE, STATUS.SETOR_EM_MANUTENCAO],
        normalizedDecision,
      );
    }

    const now = toSqlDateTime();
    const result = await client.query(
      `UPDATE ${SOLICITACAO_TABLE_NAME}
       SET
         status = $1::fabrica.status_solicitacao,
         observacao_conferente = COALESCE($2::text, observacao_conferente),
         user_conferente = CASE WHEN $2::text IS NOT NULL THEN $3 ELSE user_conferente END,
         updated_at = $4,
         updated_by = $3
       WHERE id = $5
       RETURNING id, status, entregue, data_entrega, user_recebimento, user_conferente, observacao_conferente, updated_at, updated_by`,
      [normalizedDecision, observacaoConferente || null, updatedBy, now, id],
    );

    return result.rows[0];
  });
};

export const startSolicitacao = async ({
  pool,
  id,
  targetStatus,
  updatedBy,
  usuarioCreate,
}) => {
  const normalizedTargetStatus = normalizeStartStatus(targetStatus);
  const allowedStartTargets = new Set([STATUS.GRAVACAO, STATUS.SETOR_EM_MANUTENCAO]);

  if (!allowedStartTargets.has(normalizedTargetStatus)) {
    throw new SolicitacaoFlowError(
      400,
      "STATUS_INICIO_INVALIDO",
      "Status de início inválido. Utilize gravacao ou setor_em_manutencao.",
    );
  }

  return runInTransaction(pool, async (client) => {
    const currentRow = await fetchSolicitacaoForUpdate(client, id);
    const currentStatus = normalizeCurrentStatus(currentRow.status);

    const canStartFromAceito = currentStatus === STATUS.ACEITO
      && (normalizedTargetStatus === STATUS.GRAVACAO || normalizedTargetStatus === STATUS.SETOR_EM_MANUTENCAO);
    const canResumeFromManutencao = currentStatus === STATUS.SETOR_EM_MANUTENCAO
      && normalizedTargetStatus === STATUS.GRAVACAO;

    if (!canStartFromAceito && !canResumeFromManutencao) {
      throw createTransitionError(
        currentStatus,
        [STATUS.ACEITO, STATUS.SETOR_EM_MANUTENCAO],
        normalizedTargetStatus,
      );
    }

    const now = toSqlDateTime();
    const result = await client.query(
      `UPDATE ${SOLICITACAO_TABLE_NAME}
       SET
         status = $1::fabrica.status_solicitacao,
         updated_at = $2,
         updated_by = $3
       WHERE id = $4
       RETURNING id, status, entregue, data_entrega, user_recebimento, user_conferente, observacao_conferente, updated_at, updated_by`,
      [normalizedTargetStatus, now, updatedBy, id],
    );

    if (normalizedTargetStatus === STATUS.GRAVACAO) {
      const itensSolicitacao = Array.isArray(currentRow?.dados_pedido?.items)
        ? currentRow.dados_pedido.items
        : [];

      const dataFabricacao = new Date().toISOString().slice(0, 10);
      for (const item of itensSolicitacao) {
        await cadastrarTelaService({
          db: client,
          data: {
            marca: item?.marca,
            modelo: item?.modelo,
            numerotela: item?.numero,
            cor: item?.cor,
            fios: item?.fios,
            datafabricacao: dataFabricacao,
            pecas: item?.pecas,
            status: "producao",
          },
          usuarioCreate: usuarioCreate || String(updatedBy),
          autoGenerateBarcode: true,
          fallbackDataFabricacao: dataFabricacao,
        });
      }
    }

    return result.rows[0];
  });
};

export const completeSolicitacao = async ({ pool, id, updatedBy }) => {
  return runInTransaction(pool, async (client) => {
    const currentRow = await fetchSolicitacaoForUpdate(client, id);
    const currentStatus = normalizeCurrentStatus(currentRow.status);

    if (currentStatus !== STATUS.GRAVACAO) {
      throw createTransitionError(currentStatus, STATUS.GRAVACAO, STATUS.CONCLUIDO);
    }

    const now = toSqlDateTime();
    const result = await client.query(
      `UPDATE ${SOLICITACAO_TABLE_NAME}
       SET
         status = '${STATUS.CONCLUIDO}'::fabrica.status_solicitacao,
         updated_at = $1,
         updated_by = $2
       WHERE id = $3
       RETURNING id, status, entregue, data_entrega, user_recebimento, user_conferente, observacao_conferente, updated_at, updated_by`,
      [now, updatedBy, id],
    );

    return result.rows[0];
  });
};

export const deliverSolicitacao = async ({
  pool,
  id,
  updatedBy,
  userRecebimento,
  userConferente,
}) => {
  return runInTransaction(pool, async (client) => {
    const currentRow = await fetchSolicitacaoForUpdate(client, id);
    const currentStatus = normalizeCurrentStatus(currentRow.status);

    if (currentStatus !== STATUS.CONCLUIDO) {
      throw createTransitionError(currentStatus, STATUS.CONCLUIDO, STATUS.ENTREGUE);
    }

    const now = toSqlDateTime();
    const result = await client.query(
      `UPDATE ${SOLICITACAO_TABLE_NAME}
       SET
         status = '${STATUS.ENTREGUE}'::fabrica.status_solicitacao,
         entregue = true,
         data_entrega = $1,
         user_recebimento = $2,
         user_conferente = $3,
         updated_at = $1,
         updated_by = $4
       WHERE id = $5
       RETURNING id, status, entregue, data_entrega, user_recebimento, user_conferente, observacao_conferente, updated_at, updated_by`,
      [now, userRecebimento, userConferente, updatedBy, id],
    );

    return result.rows[0];
  });
};

export const returnSolicitacao = async ({
  pool,
  id,
  updatedBy,
  userRecebimento,
  userConferente,
  observacaoConferente,
}) => {
  return runInTransaction(pool, async (client) => {
    const currentRow = await fetchSolicitacaoForUpdate(client, id);
    const currentStatus = normalizeCurrentStatus(currentRow.status);

    if (currentStatus !== STATUS.ENTREGUE) {
      throw createTransitionError(currentStatus, STATUS.ENTREGUE, STATUS.DEVOLVIDO);
    }

    const now = toSqlDateTime();
    const result = await client.query(
      `UPDATE ${SOLICITACAO_TABLE_NAME}
       SET
         status = '${STATUS.DEVOLVIDO}'::fabrica.status_solicitacao,
         entregue = false,
         user_recebimento = $2,
         user_conferente = $3,
         observacao_conferente = $4::text,
         updated_at = $1,
         updated_by = $5
       WHERE id = $6
       RETURNING id, status, entregue, data_entrega, user_recebimento, user_conferente, observacao_conferente, updated_at, updated_by`,
      [now, userRecebimento, userConferente, observacaoConferente, updatedBy, id],
    );

    return result.rows[0];
  });
};
