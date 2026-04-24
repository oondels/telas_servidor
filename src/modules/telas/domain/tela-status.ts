export const TELA_STATUS_ALLOWED = new Set(["ESTRAGADA", "PRODUCAO", "TERMINADA", "ARMAZENADA"]);

export const normalizeTelaStatus = (status: unknown): string => {
  const normalized = String(status || "PRODUCAO").trim().toUpperCase();
  return TELA_STATUS_ALLOWED.has(normalized) ? normalized : "PRODUCAO";
};
