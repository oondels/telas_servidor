import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { pool, checkDatabaseConnection } from "./database.js";
import { createSolicitacoesTelasRouter } from "./solicitacoes-telas.controller.js";

const app = express();
const port = Number(process.env.API_PORT || 3041);
const TABLE_SCHEMA = "fabrica";
const TABLE_BASENAME = "controle_telas_prateleiras";
const TABLE_NAME = `${TABLE_SCHEMA}.${TABLE_BASENAME}`;
const SOLICITACAO_TABLE_BASENAME = "solicitacao_tela";
const SOLICITACAO_TABLE_NAME = `${TABLE_SCHEMA}.${SOLICITACAO_TABLE_BASENAME}`;
const REQUIRED_COLUMNS = ["codbarrastela", "pecas", "tamanho_etiqueta", "status"];
const REQUIRED_INDEXES = [
  "idx_controle_telas_codbarrastela",
  "idx_controle_telas_status",
  "idx_controle_telas_modelo",
];
const SOLICITACAO_REQUIRED_COLUMNS = [
  "id",
  "solicitante",
  "dados_pedido",
  "motivo",
  "observacao_pedido",
  "turno_pedido",
  "data_pedido",
  "status",
  "entregue",
  "data_entrega",
  "user_recebimento",
  "user_conferente",
  "observacao_conferente",
  "created_at",
  "updated_at",
  "updated_by",
];
const SOLICITACAO_ALLOWED_STATUS = new Set([
  "pedido",
  "aceito",
  "reprovado",
  "gravacao",
  "setor_em_manutencao",
  "concluido",
  "entregue",
  "devolvido",
]);
const SOLICITACAO_TRANSITIONS = {
  pedido: new Set(["aceito", "reprovado"]),
  aceito: new Set(["gravacao", "setor_em_manutencao"]),
  reprovado: new Set(),
  gravacao: new Set(["concluido"]),
  setor_em_manutencao: new Set(["gravacao", "reprovado"]),
  concluido: new Set(["entregue"]),
  entregue: new Set(["devolvido"]),
  devolvido: new Set(),
};

app.use(cors({ origin: "*" }));
app.use(express.json());

const toSqlDateTime = () => new Date().toISOString().slice(0, 19).replace("T", " ");

const logEvent = (level, message, context = {}) => {
  const payload = {
    level,
    ts: new Date().toISOString(),
    message,
    ...context,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
};

const sendSuccess = (res, statusCode, payload = {}) => {
  return res.status(statusCode).json({
    erro: false,
    requestId: res.locals.requestId,
    ...payload,
  });
};

const sendError = (res, statusCode, code, message, details = null) => {
  return res.status(statusCode).json({
    erro: true,
    code,
    message,
    details,
    requestId: res.locals.requestId,
  });
};

app.use((req, res, next) => {
  const requestId = randomUUID();
  const start = Date.now();

  req.requestId = requestId;
  res.locals.requestId = requestId;

  res.on("finish", () => {
    logEvent("info", "request.completed", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
});

const normalizeStatus = (status) => {
  const normalized = String(status || "PRODUCAO").trim().toUpperCase();
  const allowed = new Set(["ESTRAGADA", "PRODUCAO", "TERMINADA", "ARMAZENADA"]);
  return allowed.has(normalized) ? normalized : "PRODUCAO";
};

const normalizePecas = (raw) => {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw)
      .filter(([, selected]) => Boolean(selected))
      .map(([name]) => String(name).trim())
      .filter(Boolean);
  }

  if (typeof raw === "string" && raw.trim()) {
    try {
      return normalizePecas(JSON.parse(raw));
    } catch {
      return raw
        .split("/")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const splitSlashValues = (raw) => {
  return String(raw || "")
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean);
};

const normalizeDate = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return null;

  const dateOnly = value.length >= 10 ? value.slice(0, 10) : value;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : null;
};

const parseNullableNumber = (raw) => {
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePositiveInt = (raw, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const resolveBarcode = (data) => {
  return String(data?.codbarrastela ?? data?.codBarrasTela ?? "")
    .trim()
    .toUpperCase();
};

const resolveUsuario = (req, data) => {
  const userFromBody = data?.usuario;
  const userFromHeader = req.headers["x-usuario"] ?? req.headers["x-user"];
  return String(userFromBody ?? userFromHeader ?? "")
    .trim()
    .toUpperCase();
};

const resolveSetor = (req, data) => {
  const setorFromBody = data?.setor;
  const setorFromHeader = req.headers["x-setor"];
  return String(setorFromBody ?? setorFromHeader ?? "")
    .trim()
    .toUpperCase();
};

const parseMatricula = (raw) => {
  const parsed = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeSolicitacaoStatus = (rawStatus) => {
  const normalized = String(rawStatus ?? "").trim().toLowerCase();
  return SOLICITACAO_ALLOWED_STATUS.has(normalized) ? normalized : null;
};

const normalizeSolicitacaoItem = (rawItem) => {
  const item = rawItem && typeof rawItem === "object" ? rawItem : {};

  return {
    modelo: String(item.modelo ?? "")
      .trim()
      .toUpperCase(),
    marca: String(item.marca ?? "")
      .trim()
      .toUpperCase(),
    cor: String(item.cor ?? "")
      .trim()
      .toUpperCase(),
    fios: String(item.fios ?? "")
      .trim()
      .toUpperCase(),
    pecas: normalizePecas(item.pecas ?? item.peca ?? item["peça(s)"]),
    tamanhoDoQuadro: String(item.tamanhoDoQuadro ?? item.tamanho_quadro ?? "")
      .trim()
      .toUpperCase(),
    numero: String(item.numero ?? item.numerotela ?? "")
      .trim()
      .toUpperCase(),
  };
};

const isSolicitacaoItemValid = (item) => {
  return Boolean(
    item.modelo
      && item.marca
      && item.cor
      && item.fios
      && item.tamanhoDoQuadro
      && item.numero
      && item.pecas.length,
  );
};

const normalizeSolicitacaoPayload = (rawData) => {
  const source = rawData?.dados_pedido ?? rawData ?? {};
  const rawItems = Array.isArray(source?.items)
    ? source.items
    : Array.isArray(rawData?.items)
      ? rawData.items
      : [];
  const items = rawItems.map((item) => normalizeSolicitacaoItem(item));

  return {
    items,
  };
};

const readBasicTableStatus = async (schema, table, requiredColumns) => {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schema, table],
  );

  const existing = new Set(result.rows.map((row) => row.column_name));
  const missingColumns = requiredColumns.filter((columnName) => !existing.has(columnName));

  return {
    tableExists: result.rowCount > 0,
    missingColumns,
    ok: result.rowCount > 0 && missingColumns.length === 0,
  };
};

const readSolicitacaoSchemaStatus = async () => {
  return readBasicTableStatus(TABLE_SCHEMA, SOLICITACAO_TABLE_BASENAME, SOLICITACAO_REQUIRED_COLUMNS);
};

const logSolicitacaoSchemaStatus = async () => {
  try {
    const status = await readSolicitacaoSchemaStatus();

    if (!status.tableExists) {
      logEvent("info", "schema.check.skipped", {
        table: SOLICITACAO_TABLE_NAME,
        reason: "table_not_found",
      });
      return;
    }

    if (status.ok) {
      logEvent("info", "schema.check.completed", {
        table: SOLICITACAO_TABLE_NAME,
        status: "ready",
      });
      return;
    }

    logEvent("info", "schema.check.completed", {
      table: SOLICITACAO_TABLE_NAME,
      status: "missing_columns",
      missingColumns: status.missingColumns,
    });
  } catch (error) {
    logEvent("error", "schema.check.failed", {
      table: SOLICITACAO_TABLE_NAME,
      error: error.message,
    });
  }
};

const rollbackSafely = async (client, transactionStarted) => {
  if (!transactionStarted) {
    return;
  }

  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    logEvent("error", "transaction.rollback.failed", {
      error: rollbackError.message,
    });
  }
};

const legacyPecasMigration = `
DO $migration$
DECLARE
  has_peca_column boolean := false;
  pecas_data_type text := 'text';
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = '${TABLE_SCHEMA}'
      AND table_name = '${TABLE_BASENAME}'
      AND column_name = 'peca'
  )
  INTO has_peca_column;

  SELECT COALESCE(data_type, 'text')
  INTO pecas_data_type
  FROM information_schema.columns
  WHERE table_schema = '${TABLE_SCHEMA}'
    AND table_name = '${TABLE_BASENAME}'
    AND column_name = 'pecas';

  IF pecas_data_type = 'jsonb' THEN
    IF has_peca_column THEN
      EXECUTE $sql$
        UPDATE ${TABLE_NAME}
        SET pecas = COALESCE(
          pecas,
          CASE
            WHEN peca IS NULL OR BTRIM(peca) = '' THEN '[]'::jsonb
            ELSE to_jsonb(string_to_array(REPLACE(peca, ' / ', '/'), '/'))
          END
        )
        WHERE pecas IS NULL;
      $sql$;
    ELSE
      EXECUTE $sql$
        UPDATE ${TABLE_NAME}
        SET pecas = COALESCE(pecas, '[]'::jsonb)
        WHERE pecas IS NULL;
      $sql$;
    END IF;
  ELSIF pecas_data_type = 'json' THEN
    IF has_peca_column THEN
      EXECUTE $sql$
        UPDATE ${TABLE_NAME}
        SET pecas = COALESCE(
          pecas,
          CASE
            WHEN peca IS NULL OR BTRIM(peca) = '' THEN '[]'::json
            ELSE to_json(string_to_array(REPLACE(peca, ' / ', '/'), '/'))
          END
        )
        WHERE pecas IS NULL;
      $sql$;
    ELSE
      EXECUTE $sql$
        UPDATE ${TABLE_NAME}
        SET pecas = COALESCE(pecas, '[]'::json)
        WHERE pecas IS NULL;
      $sql$;
    END IF;
  ELSE
    IF has_peca_column THEN
      EXECUTE $sql$
        UPDATE ${TABLE_NAME}
        SET pecas = COALESCE(
          pecas,
          CASE
            WHEN peca IS NULL OR BTRIM(peca) = '' THEN '[]'
            ELSE to_json(string_to_array(REPLACE(peca, ' / ', '/'), '/'))::text
          END
        )
        WHERE pecas IS NULL;
      $sql$;
    ELSE
      EXECUTE $sql$
        UPDATE ${TABLE_NAME}
        SET pecas = COALESCE(pecas, '[]')
        WHERE pecas IS NULL;
      $sql$;
    END IF;
  END IF;
END
$migration$;`;

const schemaMigrations = [
  `ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS pecas text;`,
  `ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS tamanho_etiqueta varchar(16);`,
  `ALTER TABLE ${TABLE_NAME} ALTER COLUMN codbarrastela TYPE varchar(40) USING codbarrastela::varchar;`,
  legacyPecasMigration,
  `UPDATE ${TABLE_NAME}
   SET status = 'PRODUCAO'
   WHERE status IS NULL OR BTRIM(status) = '';`,
  `CREATE INDEX IF NOT EXISTS idx_controle_telas_codbarrastela ON ${TABLE_NAME} (codbarrastela);`,
  `CREATE INDEX IF NOT EXISTS idx_controle_telas_status ON ${TABLE_NAME} (status);`,
  `CREATE INDEX IF NOT EXISTS idx_controle_telas_modelo ON ${TABLE_NAME} (modelo);`,
];

const runSchemaMigrations = async () => {
  for (const statement of schemaMigrations) {
    try {
      await pool.query(statement);
      logEvent("info", "schema.migration.applied", {
        statement: statement.split("\n")[0],
      });
    } catch (error) {
      logEvent("error", "schema.migration.failed", {
        statement: statement.split("\n")[0],
        error: error.message,
      });
    }
  }
};

const readSchemaStatus = async () => {
  const result = await pool.query(
    `SELECT column_name
          , data_type
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [TABLE_SCHEMA, TABLE_BASENAME],
  );

  const existing = new Set(result.rows.map((row) => row.column_name));
  const missingColumns = REQUIRED_COLUMNS.filter((columnName) => !existing.has(columnName));
  const codbarrastelaColumn = result.rows.find((row) => row.column_name === "codbarrastela");
  const invalidColumns = [];

  if (codbarrastelaColumn && codbarrastelaColumn.data_type !== "character varying") {
    invalidColumns.push({
      column: "codbarrastela",
      expected: "character varying",
      actual: codbarrastelaColumn.data_type,
    });
  }

  const indexesResult = await pool.query(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = $1
       AND tablename = $2`,
    [TABLE_SCHEMA, TABLE_BASENAME],
  );

  const existingIndexes = new Set(indexesResult.rows.map((row) => row.indexname));
  const missingIndexes = REQUIRED_INDEXES.filter((indexName) => !existingIndexes.has(indexName));

  let pendingDataFix = false;
  if (!missingColumns.includes("pecas") && !missingColumns.includes("status")) {
    const pendingDataFixResult = await pool.query(
      `SELECT EXISTS (
         SELECT 1
         FROM ${TABLE_NAME}
         WHERE pecas IS NULL
            OR status IS NULL
            OR BTRIM(status) = ''
       ) AS pending`,
    );

    pendingDataFix = pendingDataFixResult.rows[0]?.pending === true;
  }

  return {
    ok: result.rowCount > 0
      && missingColumns.length === 0
      && invalidColumns.length === 0
      && missingIndexes.length === 0
      && !pendingDataFix,
    tableExists: result.rowCount > 0,
    missingColumns,
    invalidColumns,
    missingIndexes,
    pendingDataFix,
  };
};

const ensureSchemaMigrations = async () => {
  try {
    const schemaStatus = await readSchemaStatus();

    if (!schemaStatus.tableExists) {
      logEvent("info", "schema.migration.skipped", {
        reason: "table_not_found",
        table: TABLE_NAME,
      });
      return;
    }

    if (schemaStatus.ok) {
      logEvent("info", "schema.migration.skipped", {
        reason: "up_to_date",
        table: TABLE_NAME,
      });
      return;
    }

    logEvent("info", "schema.migration.required", {
      table: TABLE_NAME,
      missingColumns: schemaStatus.missingColumns,
      invalidColumns: schemaStatus.invalidColumns,
      missingIndexes: schemaStatus.missingIndexes,
      pendingDataFix: schemaStatus.pendingDataFix,
    });

    await runSchemaMigrations();
  } catch (error) {
    logEvent("error", "schema.status.failed", {
      table: TABLE_NAME,
      error: error.message,
    });
  }
};

const solicitacoesTelasRouter = createSolicitacoesTelasRouter({
  pool,
  resolveUsuario,
  parseMatricula,
  sendSuccess,
  sendError,
  logEvent,
});

app.use("/solicitacoes-telas", solicitacoesTelasRouter);

app.get("/", (req, res) => {
  return sendSuccess(res, 200, { message: "Servidor de Telas ativo" });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    const schema = await readSchemaStatus();
    const solicitacoesSchema = await readSolicitacaoSchemaStatus();

    return sendSuccess(res, 200, {
      message: "healthy",
      db: true,
      schema,
      solicitacoesSchema,
    });
  } catch (error) {
    logEvent("error", "health.failed", {
      requestId: req.requestId,
      error: error.message,
    });

    return sendError(res, 500, "HEALTH_CHECK_FAILED", "Falha no health check", {
      reason: error.message,
    });
  }
});

app.get("/solicitacoes-telas", async (req, res) => {
  try {
    const status = req.query.status ? normalizeSolicitacaoStatus(req.query.status) : null;
    const solicitante = parseMatricula(req.query.solicitante);
    const search = String(req.query.search ?? "")
      .trim()
      .toUpperCase();
    const dateFrom = normalizeDate(req.query.dateFrom ?? req.query.dataInicial);
    const dateTo = normalizeDate(req.query.dateTo ?? req.query.dataFinal);
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const itemsPerPage = parsePositiveInt(req.query.itemsPerPage, 10, 200);

    const params = [];
    const where = [];

    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    if (solicitante) {
      params.push(solicitante);
      where.push(`solicitante = $${params.length}`);
    }

    if (dateFrom) {
      params.push(`${dateFrom} 00:00:00`);
      where.push(`data_pedido >= $${params.length}`);
    }

    if (dateTo) {
      params.push(`${dateTo} 23:59:59`);
      where.push(`data_pedido <= $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        UPPER(CAST(id AS TEXT)) LIKE $${params.length}
        OR CAST(solicitante AS TEXT) LIKE $${params.length}
        OR UPPER(COALESCE(motivo, '')) LIKE $${params.length}
        OR UPPER(COALESCE(observacao_pedido, '')) LIKE $${params.length}
        OR UPPER(COALESCE(turno_pedido, '')) LIKE $${params.length}
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(dados_pedido->'items', '[]'::jsonb)) AS item
          WHERE UPPER(COALESCE(item->>'modelo', '')) LIKE $${params.length}
             OR UPPER(COALESCE(item->>'marca', '')) LIKE $${params.length}
             OR UPPER(COALESCE(item->>'numero', '')) LIKE $${params.length}
             OR UPPER(COALESCE(item->>'tamanhoDoQuadro', '')) LIKE $${params.length}
        )
      )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (page - 1) * itemsPerPage;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM ${SOLICITACAO_TABLE_NAME}
      ${whereClause}
    `;

    const query = `
      SELECT *
      FROM ${SOLICITACAO_TABLE_NAME}
      ${whereClause}
      ORDER BY data_pedido DESC, created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const [countResult, result] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(query, [...params, itemsPerPage, offset]),
    ]);

    const total = Number(countResult.rows?.[0]?.total ?? 0);

    return sendSuccess(res, 200, {
      solicitacoes: result.rows,
      total,
      page,
      itemsPerPage,
      totalPages: total > 0 ? Math.ceil(total / itemsPerPage) : 0,
    });
  } catch (error) {
    logEvent("error", "buscar_solicitacoes_telas.failed", {
      requestId: req.requestId,
      error: error.message,
    });

    return sendError(res, 500, "BUSCA_SOLICITACOES_TELAS_FAILED", "Erro ao buscar solicitações", {
      reason: error.message,
    });
  }
});

app.get("/solicitacoes-telas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT *
       FROM ${SOLICITACAO_TABLE_NAME}
       WHERE id = $1`,
      [id],
    );

    if (result.rowCount === 0) {
      return sendError(res, 404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada");
    }

    return sendSuccess(res, 200, {
      solicitacao: result.rows[0],
    });
  } catch (error) {
    logEvent("error", "buscar_solicitacao_tela.failed", {
      requestId: req.requestId,
      error: error.message,
    });

    return sendError(res, 500, "BUSCA_SOLICITACAO_TELA_FAILED", "Erro ao buscar solicitação", {
      reason: error.message,
    });
  }
});

app.post("/solicitacoes-telas", async (req, res) => {
  try {
    const data = req.body || {};
    const usuario = resolveUsuario(req, data);
    const solicitante = parseMatricula(usuario);
    const dadosPedido = normalizeSolicitacaoPayload(data);
    const motivo = String(data.motivo ?? "")
      .trim() || null;
    const observacaoPedido = String(data.observacao_pedido ?? data.observacaoPedido ?? "")
      .trim() || null;
    const turnoPedido = String(data.turno_pedido ?? data.turnoPedido ?? "")
      .trim()
      .toUpperCase() || null;

    if (!solicitante) {
      return sendError(res, 400, "USUARIO_OBRIGATORIO", "Solicitante autenticado não informado");
    }

    if (!dadosPedido.items.length || dadosPedido.items.some((item) => !isSolicitacaoItemValid(item))) {
      return sendError(
        res,
        400,
        "DADOS_PEDIDO_INVALIDOS",
        "Informe ao menos um item válido para a solicitação",
      );
    }

    const now = toSqlDateTime();
    const query = `
      INSERT INTO ${SOLICITACAO_TABLE_NAME}
      (
        solicitante,
        dados_pedido,
        motivo,
        observacao_pedido,
        turno_pedido,
        data_pedido,
        status,
        entregue,
        created_at,
        updated_at,
        updated_by
      )
      VALUES ($1, $2::jsonb, $3, $4, $5, $6, 'pedido', false, $6, $6, $1)
      RETURNING id, status, data_pedido
    `;

    const values = [
      solicitante,
      JSON.stringify(dadosPedido),
      motivo,
      observacaoPedido,
      turnoPedido,
      now,
    ];

    const result = await pool.query(query, values);

    return sendSuccess(res, 201, {
      message: "success",
      solicitacao: result.rows[0],
    });
  } catch (error) {
    logEvent("error", "cadastrar_solicitacao_tela.failed", {
      requestId: req.requestId,
      error: error.message,
    });

    return sendError(res, 500, "CADASTRO_SOLICITACAO_TELA_FAILED", "Erro ao cadastrar solicitação", {
      reason: error.message,
    });
  }
});

app.put("/solicitacoes-telas/:id/status", async (req, res) => {
  try {
    const data = req.body || {};
    const { id } = req.params;
    const usuario = resolveUsuario(req, data);
    const usuarioId = parseMatricula(usuario);
    const setor = resolveSetor(req, data);
    const proximoStatus = normalizeSolicitacaoStatus(data.status);
    const observacaoConferente = String(data.observacao_conferente ?? data.observacaoConferente ?? "")
      .trim() || null;

    if (!usuarioId) {
      return sendError(res, 400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
    }

    if (setor !== "SERIGRAFIA" && setor !== "AUTOMACAO") {
      return sendError(res, 403, "SETOR_NAO_AUTORIZADO", "Somente o setor SERIGRAFIA pode atualizar o status");
    }

    if (!proximoStatus) {
      return sendError(res, 400, "STATUS_INVALIDO", "Status inválido para atualização");
    }

    if (proximoStatus === "reprovado" && !observacaoConferente) {
      return sendError(res, 400, "OBSERVACAO_OBRIGATORIA", "Informe uma observação para recusar ou cancelar");
    }

    const currentResult = await pool.query(
      `SELECT id, status
       FROM ${SOLICITACAO_TABLE_NAME}
       WHERE id = $1`,
      [id],
    );

    if (currentResult.rowCount === 0) {
      return sendError(res, 404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada");
    }

    const currentStatus = normalizeSolicitacaoStatus(currentResult.rows[0]?.status);
    const allowedTransitions = currentStatus ? SOLICITACAO_TRANSITIONS[currentStatus] : null;

    if (!allowedTransitions?.has(proximoStatus)) {
      return sendError(
        res,
        409,
        "TRANSICAO_STATUS_INVALIDA",
        "Transição de status não permitida",
        {
          atual: currentStatus,
          proximo: proximoStatus,
        },
      );
    }

    const now = toSqlDateTime();
    const statusConcluido = proximoStatus === "concluido";
    const query = `
      UPDATE ${SOLICITACAO_TABLE_NAME}
      SET
        status = $1::fabrica.status_solicitacao,
        entregue = CASE WHEN $5 THEN true ELSE entregue END,
        data_entrega = CASE WHEN $5 THEN $2 ELSE data_entrega END,
        user_recebimento = CASE WHEN $5 THEN $3 ELSE user_recebimento END,
        user_conferente = CASE WHEN NULLIF(BTRIM($6::text), '') IS NOT NULL THEN $3 ELSE user_conferente END,
        observacao_conferente = COALESCE(NULLIF(BTRIM($6::text), ''), observacao_conferente),
        updated_at = $2,
        updated_by = $3
      WHERE id = $4
      RETURNING id, status, entregue, data_entrega, user_recebimento, user_conferente, observacao_conferente, updated_at
    `;

    const result = await pool.query(query, [proximoStatus, now, usuarioId, id, statusConcluido, observacaoConferente]);

    return sendSuccess(res, 200, {
      message: "success",
      solicitacao: result.rows[0],
    });
  } catch (error) {
    logEvent("error", "atualizar_status_solicitacao_tela.failed", {
      requestId: req.requestId,
      error: error.message,
    });

    return sendError(res, 500, "ATUALIZAR_STATUS_SOLICITACAO_TELA_FAILED", "Erro ao atualizar status", {
      reason: error.message,
    });
  }
});

app.get("/buscar-telas", async (req, res) => {
  try {
    const letra = req.query.letra ? String(req.query.letra).trim().toUpperCase() : "";
    const modelo = req.query.modelo ? String(req.query.modelo).trim().toUpperCase() : "";
    const status = req.query.status ? normalizeStatus(req.query.status) : "";
    const endereco = req.query.endereco ? String(req.query.endereco).trim().toUpperCase() : "";
    const search = req.query.search ? String(req.query.search).trim().toUpperCase() : "";
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const itemsPerPage = parsePositiveInt(req.query.itemsPerPage, 10, 200);

    const params = [];
    const where = [];

    if (letra) {
      params.push(letra);
      where.push(`UPPER(SUBSTRING(modelo, 1, 1)) = $${params.length}`);
    }

    if (modelo) {
      params.push(`${modelo}%`);
      where.push(`UPPER(modelo) LIKE $${params.length}`);
    }

    if (status) {
      params.push(status);
      where.push(`UPPER(status) = $${params.length}`);
    }

    if (endereco) {
      params.push(`${endereco}%`);
      where.push(`UPPER(COALESCE(endereco, '')) LIKE $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        UPPER(COALESCE(modelo, '')) LIKE $${params.length}
        OR UPPER(COALESCE(marca, '')) LIKE $${params.length}
        OR UPPER(COALESCE(numerotela, '')) LIKE $${params.length}
        OR UPPER(COALESCE(codbarrastela, '')) LIKE $${params.length}
        OR UPPER(COALESCE(endereco, '')) LIKE $${params.length}
        OR CAST(id AS TEXT) LIKE $${params.length}
      )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (page - 1) * itemsPerPage;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM ${TABLE_NAME}
      ${whereClause}
    `;

    const query = `
      SELECT *
      FROM ${TABLE_NAME}
      ${whereClause}
      ORDER BY modelo, numerotela, endereco
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const [countResult, result] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(query, [...params, itemsPerPage, offset]),
    ]);

    const total = Number(countResult.rows?.[0]?.total ?? 0);

    return sendSuccess(res, 200, {
      telas: result.rows,
      total,
      page,
      itemsPerPage,
      totalPages: total > 0 ? Math.ceil(total / itemsPerPage) : 0,
    });
  } catch (error) {
    logEvent("error", "buscar_telas.failed", {
      requestId: req.requestId,
      error: error.message,
    });

    return sendError(res, 500, "BUSCA_TELAS_FAILED", "Erro na consulta ao banco de dados", {
      reason: error.message,
    });
  }
});

app.post("/cadastrar-tela", async (req, res) => {
  try {
    const data = req.body || {};
    const usuario = resolveUsuario(req, data);
    const codbarrastela = resolveBarcode(data);

    if (!usuario) {
      return sendError(res, 400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
    }

    if (!codbarrastela) {
      return sendError(res, 400, "CODIGO_BARRAS_OBRIGATORIO", "Código de barras não informado");
    }

    const now = toSqlDateTime();
    const marca = String(data.marca || "").trim().toUpperCase();
    const modelo = String(data.modelo || "").trim().toUpperCase();
    const numerotela = String(data.numerotela || "").trim().toUpperCase();
    const cor = parseNullableNumber(data.cor);
    const fios = parseNullableNumber(data.fios);
    const datafabricacao = normalizeDate(data?.datafabricacao ?? data?.dataFabricacao);
    const pecas = JSON.stringify(normalizePecas(data.pecas ?? data.components));
    const tamanhoEtiquetaRaw = data.tamanhoEtiqueta ?? data.tamanho_etiqueta ?? null;
    const tamanho_etiqueta = tamanhoEtiquetaRaw ? String(tamanhoEtiquetaRaw).trim().toUpperCase() : null;
    const status = normalizeStatus(data.status);

    if (!marca || !modelo || !numerotela || !datafabricacao) {
      return sendError(
        res,
        400,
        "DADOS_INVALIDOS_CADASTRO",
        "Campos obrigatórios ausentes para cadastro",
      );
    }

    const checkQuery = `SELECT id FROM ${TABLE_NAME} WHERE codbarrastela = $1`;
    const checkResult = await pool.query(checkQuery, [codbarrastela]);

    if (checkResult.rowCount > 0) {
      return sendError(res, 409, "TELA_DUPLICADA", "Tela já cadastrada");
    }

    const insertQuery = `
      INSERT INTO ${TABLE_NAME}
      (
        createdate,
        updatedate,
        usuariocreate,
        marca,
        modelo,
        numerotela,
        cor,
        fios,
        datafabricacao,
        pecas,
        tamanho_etiqueta,
        codbarrastela,
        status,
        usuariostatus,
        usuarioaltera
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `;

    const values = [
      now,
      now,
      usuario,
      marca,
      modelo,
      numerotela,
      cor,
      fios,
      datafabricacao,
      pecas,
      tamanho_etiqueta,
      codbarrastela,
      status,
      usuario,
      usuario,
    ];

    const result = await pool.query(insertQuery, values);

    return sendSuccess(res, 201, {
      message: "success",
      id: result.rows[0]?.id,
    });
  } catch (error) {
    logEvent("error", "cadastrar_tela.failed", {
      requestId: req.requestId,
      error: error.message,
    });

    return sendError(res, 500, "CADASTRO_TELA_FAILED", "Erro ao cadastrar tela", {
      reason: error.message,
    });
  }
});

app.put("/atualizar-posicao", async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    const { telas, endereco } = req.body || {};
    const usuario = resolveUsuario(req, req.body || {});

    if (!usuario) {
      return sendError(res, 400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
    }

    const listaTelas = splitSlashValues(telas).map((item) => item.toUpperCase());
    const listaEnderecosRaw = splitSlashValues(endereco).map((item) => item.toUpperCase());

    if (!listaTelas.length) {
      return sendError(res, 400, "TELAS_OBRIGATORIAS", "Informe pelo menos uma tela para movimentação");
    }

    if (!listaEnderecosRaw.length) {
      return sendError(res, 400, "ENDERECO_OBRIGATORIO", "Informe um endereço para movimentação");
    }

    const listaEnderecos =
      listaEnderecosRaw.length === 1
        ? listaTelas.map(() => listaEnderecosRaw[0])
        : listaEnderecosRaw;

    if (listaEnderecos.length !== listaTelas.length) {
      return sendError(
        res,
        400,
        "MATRIZ_INVALIDA",
        "Quantidade de endereços incompatível com a quantidade de telas",
      );
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const updateDate = toSqlDateTime();
    for (let i = 0; i < listaTelas.length; i += 1) {
      const codigoTela = listaTelas[i];
      const novoEndereco = listaEnderecos[i];

      const query = `
        UPDATE ${TABLE_NAME}
        SET
          updatedate = $1,
          usuarioendereco = $2,
          endereco = $3,
          usuarioaltera = $2
        WHERE codbarrastela = $4
      `;

      const result = await client.query(query, [updateDate, usuario, novoEndereco, codigoTela]);
      if (result.rowCount === 0) {
        throw new Error(`TELA_NAO_ENCONTRADA:${codigoTela}`);
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return sendSuccess(res, 200, {
      message: "success",
      atualizadas: listaTelas.length,
    });
  } catch (error) {
    await rollbackSafely(client, transactionStarted);

    if (error.message.startsWith("TELA_NAO_ENCONTRADA:")) {
      const codigo = error.message.split(":")[1] || null;
      return sendError(res, 404, "TELA_NAO_ENCONTRADA", "Uma ou mais telas não foram encontradas", {
        codigo,
      });
    }

    logEvent("error", "atualizar_posicao.failed", {
      requestId: req.requestId,
      error: error.message,
    });

    return sendError(res, 500, "ATUALIZAR_POSICAO_FAILED", "Erro ao atualizar posição", {
      reason: error.message,
    });
  } finally {
    client.release();
  }
});

app.put("/atualizar-status", async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    const { telas, status } = req.body || {};
    const usuario = resolveUsuario(req, req.body || {});

    if (!usuario) {
      return sendError(res, 400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
    }

    const listaTelas = splitSlashValues(telas).map((item) => item.toUpperCase());
    if (!listaTelas.length) {
      return sendError(res, 400, "TELAS_OBRIGATORIAS", "Informe pelo menos uma tela para atualizar status");
    }

    const statusNormalizado = normalizeStatus(status);

    await client.query("BEGIN");
    transactionStarted = true;

    const updateDate = toSqlDateTime();
    for (const codigoTela of listaTelas) {
      const query = `
        UPDATE ${TABLE_NAME}
        SET
          updatedate = $1,
          usuariostatus = $2,
          status = $3,
          usuarioaltera = $2
        WHERE codbarrastela = $4
      `;

      const result = await client.query(query, [updateDate, usuario, statusNormalizado, codigoTela]);
      if (result.rowCount === 0) {
        throw new Error(`TELA_NAO_ENCONTRADA:${codigoTela}`);
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return sendSuccess(res, 200, {
      message: "success",
      atualizadas: listaTelas.length,
      status: statusNormalizado,
    });
  } catch (error) {
    await rollbackSafely(client, transactionStarted);

    if (error.message.startsWith("TELA_NAO_ENCONTRADA:")) {
      const codigo = error.message.split(":")[1] || null;
      return sendError(res, 404, "TELA_NAO_ENCONTRADA", "Uma ou mais telas não foram encontradas", {
        codigo,
      });
    }

    logEvent("error", "atualizar_status.failed", {
      requestId: req.requestId,
      error: error.message,
    });

    return sendError(res, 500, "ATUALIZAR_STATUS_FAILED", "Erro ao atualizar status", {
      reason: error.message,
    });
  } finally {
    client.release();
  }
});

app.put("/editar-tela", async (req, res) => {
  try {
    const data = req.body || {};
    const usuario = resolveUsuario(req, data);
    const codbarrastela = resolveBarcode(data);

    if (!usuario) {
      return sendError(res, 400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
    }

    if (!codbarrastela) {
      return sendError(res, 400, "CODIGO_BARRAS_OBRIGATORIO", "Código de barras não fornecido para edição");
    }

    const updateDate = toSqlDateTime();
    const marca = data.marca ? String(data.marca).trim().toUpperCase() : null;
    const modelo = data.modelo ? String(data.modelo).trim().toUpperCase() : null;
    const numerotela = data.numerotela ? String(data.numerotela).trim().toUpperCase() : null;
    const cor = parseNullableNumber(data.cor);
    const fios = parseNullableNumber(data.fios);
    const datafabricacao =
      data.datafabricacao !== undefined || data.dataFabricacao !== undefined
        ? normalizeDate(data.datafabricacao ?? data.dataFabricacao)
        : null;
    const pecas =
      data.pecas !== undefined || data.components !== undefined
        ? JSON.stringify(normalizePecas(data.pecas ?? data.components))
        : null;
    const status = data.status !== undefined ? normalizeStatus(data.status) : null;
    const endereco = data.endereco !== undefined ? String(data.endereco || "").trim().toUpperCase() || null : null;
    const tamanhoEtiquetaRaw = data.tamanhoEtiqueta ?? data.tamanho_etiqueta;
    const tamanho_etiqueta = tamanhoEtiquetaRaw !== undefined ? String(tamanhoEtiquetaRaw || "").trim().toUpperCase() || null : null;

    const query = `
      UPDATE ${TABLE_NAME}
      SET
        updatedate = $1,
        usuariostatus = $2,
        usuarioaltera = $2,
        marca = COALESCE($3, marca),
        modelo = COALESCE($4, modelo),
        numerotela = COALESCE($5, numerotela),
        cor = COALESCE($6, cor),
        fios = COALESCE($7, fios),
        datafabricacao = COALESCE($8, datafabricacao),
        pecas = COALESCE($9, pecas),
        status = COALESCE($10, status),
        endereco = COALESCE($11, endereco),
        tamanho_etiqueta = COALESCE($12, tamanho_etiqueta)
      WHERE codbarrastela = $13
      RETURNING id, codbarrastela, status, endereco, updatedate
    `;

    const values = [
      updateDate,
      usuario,
      marca,
      modelo,
      numerotela,
      cor,
      fios,
      datafabricacao,
      pecas,
      status,
      endereco,
      tamanho_etiqueta,
      codbarrastela,
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return sendError(res, 404, "TELA_NAO_ENCONTRADA", "Tela não encontrada para atualização");
    }

    return sendSuccess(res, 200, {
      message: "success",
      tela: result.rows[0],
    });
  } catch (error) {
    logEvent("error", "editar_tela.failed", {
      requestId: req.requestId,
      error: error.message,
    });

    return sendError(res, 500, "EDITAR_TELA_FAILED", "Erro ao editar tela", {
      reason: error.message,
    });
  }
});

app.use((error, req, res, next) => {
  logEvent("error", "unhandled.error", {
    requestId: req?.requestId,
    error: error?.message || "Erro desconhecido",
  });

  if (res.headersSent) {
    return next(error);
  }

  return sendError(res, 500, "UNHANDLED_EXCEPTION", "Erro interno não tratado");
});

const startServer = async () => {
  await ensureSchemaMigrations();
  await logSolicitacaoSchemaStatus();

  try {
    await checkDatabaseConnection();
  } catch (error) {
    logEvent("error", "database.check.failed", {
      error: error.message,
    });
  }

  app.listen(port, () => {
    logEvent("info", "server.started", { port });
  });
};

startServer().catch((error) => {
  logEvent("error", "server.start.failed", {
    error: error.message,
  });
  process.exit(1);
});
