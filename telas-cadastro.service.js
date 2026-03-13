const TABLE_NAME = "fabrica.controle_telas_prateleiras";

const STATUS_ALLOWED = new Set(["ESTRAGADA", "PRODUCAO", "TERMINADA", "ARMAZENADA"]);

const toSqlDateTime = () => {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "America/Bahia"
  });
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

const normalizeStatus = (status) => {
  const normalized = String(status || "PRODUCAO").trim().toUpperCase();
  return STATUS_ALLOWED.has(normalized) ? normalized : "PRODUCAO";
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

const resolveBarcode = (data) => {
  return String(data?.codbarrastela ?? data?.codBarrasTela ?? "")
    .trim()
    .toUpperCase();
};

const normalizeUsuarioCreate = (rawUsuario) => {
  return String(rawUsuario ?? "")
    .trim()
    .toUpperCase();
};

const generateBarcodeCandidate = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");

  return `TL${ts}${rnd}`.slice(0, 40);
};

const generateUniqueBarcode = async (db) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateBarcodeCandidate();
    const existsResult = await db.query(
      `SELECT 1
       FROM ${TABLE_NAME}
       WHERE codbarrastela = $1
       LIMIT 1`,
      [candidate],
    );

    if (existsResult.rowCount === 0) {
      return candidate;
    }
  }

  throw new Error("Nao foi possível gerar código de barras único");
};

export class TelaCadastroError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = "TelaCadastroError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const cadastrarTelaService = async ({
  db,
  data,
  usuarioCreate,
  autoGenerateBarcode = false,
  fallbackDataFabricacao = null,
}) => {
  const usuario = normalizeUsuarioCreate(usuarioCreate);
  if (!usuario) {
    throw new TelaCadastroError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
  }

  let codbarrastela = resolveBarcode(data);
  if (!codbarrastela && autoGenerateBarcode) {
    codbarrastela = await generateUniqueBarcode(db);
  }

  if (!codbarrastela) {
    throw new TelaCadastroError(400, "CODIGO_BARRAS_OBRIGATORIO", "Código de barras não informado");
  }

  const now = toSqlDateTime();
  console.log(`Data de cadastro: ${toSqlDateTime}`);


  const marca = String(data?.marca || "").trim().toUpperCase();
  const modelo = String(data?.modelo || "").trim().toUpperCase();
  const numerotela = String(data?.numerotela ?? data?.numero ?? "").trim().toUpperCase();
  const cor = parseNullableNumber(data?.cor);
  const fios = parseNullableNumber(data?.fios);
  const datafabricacao =
    normalizeDate(data?.datafabricacao ?? data?.dataFabricacao)
    ?? normalizeDate(fallbackDataFabricacao);
  const pecas = JSON.stringify(normalizePecas(data?.pecas ?? data?.components));
  const tamanhoEtiquetaRaw = data?.tamanhoEtiqueta ?? data?.tamanho_etiqueta ?? null;
  const tamanho_etiqueta = tamanhoEtiquetaRaw ? String(tamanhoEtiquetaRaw).trim().toUpperCase() : null;
  const status = normalizeStatus(data?.status);

  if (!marca || !modelo || !numerotela || !datafabricacao) {
    throw new TelaCadastroError(
      400,
      "DADOS_INVALIDOS_CADASTRO",
      "Campos obrigatórios ausentes para cadastro",
    );
  }

  const duplicateQuery = `SELECT id FROM ${TABLE_NAME} WHERE codbarrastela = $1`;
  const duplicateResult = await db.query(duplicateQuery, [codbarrastela]);
  if (duplicateResult.rowCount > 0) {
    throw new TelaCadastroError(409, "TELA_DUPLICADA", "Tela já cadastrada", {
      codbarrastela,
    });
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
    RETURNING id, codbarrastela, numerotela, modelo, marca, status
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

  const result = await db.query(insertQuery, values);
  return result.rows[0];
};

