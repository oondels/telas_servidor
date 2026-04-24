export const parseNullableNumber = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parsePositiveInt = (
  raw: unknown,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
): number => {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

export const parseMatricula = (raw: unknown): number | null => {
  const parsed = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const splitSlashValues = (raw: unknown): string[] => {
  return String(raw ?? "")
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean);
};
