export const normalizePecas = (raw: unknown): string[] => {
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
