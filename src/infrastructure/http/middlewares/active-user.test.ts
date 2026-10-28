import { describe, expect, it, vi } from "vitest";
import { USER_ROLES } from "../../../modules/users/domain/user-role.js";
import { requireRoles } from "./active-user.js";

describe("requireRoles", () => {
  it("allows requests with an accepted role", () => {
    const next = vi.fn();
    const req = { appUser: { role: USER_ROLES.ADMIN } };

    requireRoles(USER_ROLES.ADMIN)(req as never, {} as never, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects requests with insufficient role", () => {
    const req = { appUser: { role: USER_ROLES.USUARIO_PRODUCAO } };

    expect(() => requireRoles(USER_ROLES.ADMIN)(req as never, {} as never, vi.fn()))
      .toThrowError(/Perfil sem permissão/);
  });
});

describe("loadActiveUser", () => {
  it("authorizes central is_admin = true when not registered locally in telas", async () => {
    const next = vi.fn();
    const req = {
      user: { id: 1, usuario: "SUPER.ADMIN", matricula: 9999999, is_admin: true },
      appUser: undefined,
    };
    const mockRepo = {
      findActiveByMatricula: vi.fn().mockResolvedValue(null),
    };

    const middleware = (await import("./active-user.js")).loadActiveUser(mockRepo as never);
    await middleware(req as never, {} as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as any).appUser.role).toBe(USER_ROLES.ADMIN);
  });

  it("blocks user without local registration and without is_admin", async () => {
    const next = vi.fn();
    const req = {
      user: { id: 2, usuario: "OPERADOR.COMUM", matricula: 1234567, is_admin: false },
      appUser: undefined,
    };
    const mockRepo = {
      findActiveByMatricula: vi.fn().mockResolvedValue(null),
    };

    const middleware = (await import("./active-user.js")).loadActiveUser(mockRepo as never);
    await expect(middleware(req as never, {} as never, next)).rejects.toThrowError(/Usuário não cadastrado ou inativo/);
    expect(next).not.toHaveBeenCalled();
  });
});
