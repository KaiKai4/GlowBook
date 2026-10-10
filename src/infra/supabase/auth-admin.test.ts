import { AuthError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAuthUserByEmail } from "./auth-admin";

const admin = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("./admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: admin.rpc,
    auth: { admin: { getUserById: admin.getUserById } },
  }),
}));

const USER_ID = "00000000-0000-4000-8000-0000000000e1";
const USER = { id: USER_ID, email: "owner@glowbook.test" };

describe("findAuthUserByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("busca el id con la RPC por email y devuelve el usuario completo", async () => {
    admin.rpc.mockResolvedValue({ data: USER_ID, error: null });
    admin.getUserById.mockResolvedValue({ data: { user: USER }, error: null });

    const result = await findAuthUserByEmail("  Owner@GlowBook.test ");

    expect(admin.rpc).toHaveBeenCalledWith("find_auth_user_id_by_email", {
      p_email: "  Owner@GlowBook.test ",
    });
    expect(admin.getUserById).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual({ data: USER, error: null });
  });

  it("devuelve data null y sin error cuando no hay usuario con ese email", async () => {
    admin.rpc.mockResolvedValue({ data: null, error: null });

    expect(await findAuthUserByEmail("nadie@glowbook.test")).toEqual({ data: null, error: null });
    expect(admin.getUserById).not.toHaveBeenCalled();
  });

  it("convierte el error de la RPC en AuthError sin mostrar el objeto crudo", async () => {
    admin.rpc.mockResolvedValue({ data: null, error: { message: "permission denied", code: "42501" } });

    const result = await findAuthUserByEmail("owner@glowbook.test");

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AuthError);
    expect(result.error?.message).toBe("permission denied");
    expect(admin.getUserById).not.toHaveBeenCalled();
  });

  it("propaga el error de Auth al leer el usuario por id", async () => {
    const authError = new AuthError("usuario no encontrado", 404);
    admin.rpc.mockResolvedValue({ data: USER_ID, error: null });
    admin.getUserById.mockResolvedValue({ data: { user: null }, error: authError });

    expect(await findAuthUserByEmail("owner@glowbook.test")).toEqual({ data: null, error: authError });
  });
});
