-- Migration: adiciona novos valores ao enum de status da solicitação de telas.
-- Necessário para suportar os estados finais de entrega e devolução.

BEGIN;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type type_def
    JOIN pg_namespace namespace_def
      ON namespace_def.oid = type_def.typnamespace
    WHERE namespace_def.nspname = 'fabrica'
      AND type_def.typname = 'status_solicitacao'
  ) THEN
    ALTER TYPE fabrica."status_solicitacao" ADD VALUE IF NOT EXISTS 'entregue';
    ALTER TYPE fabrica."status_solicitacao" ADD VALUE IF NOT EXISTS 'devolvido';
  END IF;
END
$migration$;

COMMIT;

