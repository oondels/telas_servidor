export const logEvent = (level: "info" | "error", message: string, context: Record<string, unknown> = {}) => {
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
