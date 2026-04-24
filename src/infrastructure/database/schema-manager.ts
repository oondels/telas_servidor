import { AppDataSource } from "./data-source.js";
import { logEvent } from "../../shared/http/logger.js";

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

const readBasicTableStatus = async (schema: string, table: string, requiredColumns: string[]) => {
  const rows = await AppDataSource.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schema, table],
  );

  const existing = new Set(rows.map((row: { column_name: string }) => row.column_name));
  const missingColumns = requiredColumns.filter((columnName) => !existing.has(columnName));

  return {
    tableExists: rows.length > 0,
    missingColumns,
    ok: rows.length > 0 && missingColumns.length === 0,
  };
};

export const readSolicitacaoSchemaStatus = async () => {
  return readBasicTableStatus(TABLE_SCHEMA, SOLICITACAO_TABLE_BASENAME, SOLICITACAO_REQUIRED_COLUMNS);
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
  `UPDATE ${TABLE_NAME} SET status = 'PRODUCAO' WHERE status IS NULL OR BTRIM(status) = '';`,
  `CREATE INDEX IF NOT EXISTS idx_controle_telas_codbarrastela ON ${TABLE_NAME} (codbarrastela);`,
  `CREATE INDEX IF NOT EXISTS idx_controle_telas_status ON ${TABLE_NAME} (status);`,
  `CREATE INDEX IF NOT EXISTS idx_controle_telas_modelo ON ${TABLE_NAME} (modelo);`,
];

export const readTelasSchemaStatus = async () => {
  const rows = await AppDataSource.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [TABLE_SCHEMA, TABLE_BASENAME],
  );

  const existing = new Set(rows.map((row: { column_name: string }) => row.column_name));
  const missingColumns = REQUIRED_COLUMNS.filter((columnName) => !existing.has(columnName));
  const codbarrastelaColumn = rows.find((row: { column_name: string }) => row.column_name === "codbarrastela");
  const invalidColumns: Array<{ column: string; expected: string; actual: string }> = [];

  if (codbarrastelaColumn && codbarrastelaColumn.data_type !== "character varying") {
    invalidColumns.push({
      column: "codbarrastela",
      expected: "character varying",
      actual: codbarrastelaColumn.data_type,
    });
  }

  const indexRows = await AppDataSource.query(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = $1
       AND tablename = $2`,
    [TABLE_SCHEMA, TABLE_BASENAME],
  );

  const existingIndexes = new Set(indexRows.map((row: { indexname: string }) => row.indexname));
  const missingIndexes = REQUIRED_INDEXES.filter((indexName) => !existingIndexes.has(indexName));

  let pendingDataFix = false;
  if (!missingColumns.includes("pecas") && !missingColumns.includes("status")) {
    const [row] = await AppDataSource.query(
      `SELECT EXISTS (
         SELECT 1
         FROM ${TABLE_NAME}
         WHERE pecas IS NULL
            OR status IS NULL
            OR BTRIM(status) = ''
       ) AS pending`,
    );

    pendingDataFix = row?.pending === true;
  }

  return {
    ok: rows.length > 0
      && missingColumns.length === 0
      && invalidColumns.length === 0
      && missingIndexes.length === 0
      && !pendingDataFix,
    tableExists: rows.length > 0,
    missingColumns,
    invalidColumns,
    missingIndexes,
    pendingDataFix,
  };
};

export const ensureLegacySchema = async () => {
  const schemaStatus = await readTelasSchemaStatus();

  if (!schemaStatus.tableExists) {
    logEvent("info", "schema.migration.skipped", {
      reason: "table_not_found",
      table: TABLE_NAME,
    });
  } else if (!schemaStatus.ok) {
    logEvent("info", "schema.migration.required", {
      table: TABLE_NAME,
      missingColumns: schemaStatus.missingColumns,
      invalidColumns: schemaStatus.invalidColumns,
      missingIndexes: schemaStatus.missingIndexes,
      pendingDataFix: schemaStatus.pendingDataFix,
    });

    for (const statement of schemaMigrations) {
      try {
        await AppDataSource.query(statement);
        logEvent("info", "schema.migration.applied", {
          statement: statement.split("\n")[0],
        });
      } catch (error) {
        logEvent("error", "schema.migration.failed", {
          statement: statement.split("\n")[0],
          error: (error as Error).message,
        });
      }
    }
  } else {
    logEvent("info", "schema.migration.skipped", {
      reason: "up_to_date",
      table: TABLE_NAME,
    });
  }

  try {
    const solicitacoesStatus = await readSolicitacaoSchemaStatus();
    logEvent("info", "schema.check.completed", {
      table: SOLICITACAO_TABLE_NAME,
      status: solicitacoesStatus.ok ? "ready" : "missing_columns",
      missingColumns: solicitacoesStatus.ok ? undefined : solicitacoesStatus.missingColumns,
    });
  } catch (error) {
    logEvent("error", "schema.check.failed", {
      table: SOLICITACAO_TABLE_NAME,
      error: (error as Error).message,
    });
  }
};
