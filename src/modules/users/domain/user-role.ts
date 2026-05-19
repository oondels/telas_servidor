export const USER_ROLES = {
  ADMIN: "ADMIN",
  OPERADOR_TELAS: "OPERADOR_TELAS",
  MOVIMENTADOR: "MOVIMENTADOR",
  USUARIO_PRODUCAO: "USUARIO_PRODUCAO",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

const allowedRoles = new Set<string>(Object.values(USER_ROLES));

export const normalizeUserRole = (role: unknown): UserRole | null => {
  const normalized = String(role ?? "").trim().toUpperCase();
  return allowedRoles.has(normalized) ? (normalized as UserRole) : null;
};

export const canManageTelas = (role: UserRole) => {
  return role === USER_ROLES.ADMIN || role === USER_ROLES.OPERADOR_TELAS;
};

export const canMoveSolicitacoes = (role: UserRole) => {
  return role === USER_ROLES.ADMIN || role === USER_ROLES.OPERADOR_TELAS || role === USER_ROLES.MOVIMENTADOR;
};
