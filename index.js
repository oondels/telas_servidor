import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { pool, checkDatabaseConnection } from "./database.js";

const app = express();
const port = Number(process.env.API_PORT || 3000);
const TABLE_NAME = "fabrica.controle_telas_prateleiras";
const REQUIRED_COLUMNS = ["codbarrastela", "pecas", "tamanho_etiqueta", "status"];

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

const schemaMigrations = [
  `ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS pecas text;`,
  `ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS tamanho_etiqueta varchar(16);`,
  `ALTER TABLE ${TABLE_NAME} ALTER COLUMN codbarrastela TYPE varchar(40) USING codbarrastela::varchar;`,
  `UPDATE ${TABLE_NAME}
   SET pecas = COALESCE(
     pecas,
     CASE
       WHEN peca IS NULL OR BTRIM(peca) = '' THEN '[]'
       ELSE to_json(string_to_array(REPLACE(peca, ' / ', '/'), '/'))::text
     END
   )
   WHERE pecas IS NULL;`,
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
     FROM information_schema.columns
     WHERE table_schema = 'fabrica'
       AND table_name = 'controle_telas_prateleiras'`,
  );

  const existing = new Set(result.rows.map((row) => row.column_name));
  const missingColumns = REQUIRED_COLUMNS.filter((columnName) => !existing.has(columnName));

  return {
    ok: missingColumns.length === 0,
    missingColumns,
  };
};

app.get("/", (req, res) => {
  return sendSuccess(res, 200, { message: "Servidor de Telas ativo" });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    const schema = await readSchemaStatus();

    return sendSuccess(res, 200, {
      message: "healthy",
      db: true,
      schema,
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

app.get("/buscar-telas", async (req, res) => {
  try {
    const letra = req.query.letra ? String(req.query.letra).trim().toUpperCase() : "";
    const modelo = req.query.modelo ? String(req.query.modelo).trim().toUpperCase() : "";
    const status = req.query.status ? normalizeStatus(req.query.status) : "";
    const endereco = req.query.endereco ? String(req.query.endereco).trim().toUpperCase() : "";

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

    const query = `
      SELECT *
      FROM ${TABLE_NAME}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY modelo, numerotela, endereco
    `;

    const result = await pool.query(query, params);

    return sendSuccess(res, 200, {
      telas: result.rows,
      total: result.rowCount,
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

    return sendSuccess(res, 200, {
      message: "success",
      atualizadas: listaTelas.length,
    });
  } catch (error) {
    await client.query("ROLLBACK");

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

    return sendSuccess(res, 200, {
      message: "success",
      atualizadas: listaTelas.length,
      status: statusNormalizado,
    });
  } catch (error) {
    await client.query("ROLLBACK");

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
  await runSchemaMigrations();

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
