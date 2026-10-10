import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import { isPlatformAdminUser } from "./platform-admins.repo";

vi.mock("server-only", () => ({}));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

const mockedAdmin = vi.mocked(createSupabaseAdminClient);

function adminWith(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  mockedAdmin.mockReturnValue({ from } as never);
  return { from, select, eq };
}

describe("isPlatformAdminUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta platform_admins filtrando por el usuario", async () => {
    const { from, eq } = adminWith({ data: { user_id: "admin-1" }, error: null });

    await isPlatformAdminUser("admin-1");

    expect(from).toHaveBeenCalledWith("platform_admins");
    expect(eq).toHaveBeenCalledWith("user_id", "admin-1");
  });

  it("devuelve true cuando el usuario es administrador de plataforma", async () => {
    adminWith({ data: { user_id: "admin-1" }, error: null });

    await expect(isPlatformAdminUser("admin-1")).resolves.toBe(true);
  });

  it("devuelve false cuando el usuario no figura en la tabla", async () => {
    adminWith({ data: null, error: null });

    await expect(isPlatformAdminUser("u-2")).resolves.toBe(false);
  });

  it("lanza el error de la consulta en lugar de tratarlo como no admin", async () => {
    const failure = new Error("db caida");
    adminWith({ data: null, error: failure });

    await expect(isPlatformAdminUser("admin-1")).rejects.toBe(failure);
  });
});
