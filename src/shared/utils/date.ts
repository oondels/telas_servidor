export const toBahiaSqlDateTime = (date = new Date()): string => {
  return date.toLocaleString("sv-SE", {
    timeZone: "America/Bahia",
  });
};

export const normalizeDate = (raw: unknown): string | null => {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const dateOnly = value.length >= 10 ? value.slice(0, 10) : value;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : null;
};
