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
