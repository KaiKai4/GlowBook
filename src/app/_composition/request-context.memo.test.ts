import { beforeEach, describe, expect, it, vi } from "vitest";

// Comprueba la memoizacion por peticion: react cache se simula con un memo por
// argumento (en una peticion real dura lo que dura la peticion). Cada test carga
// el modulo en un registro limpio para que el memo empiece vacio.

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (arg?: string) => unknown>(fn: T) => {
    const memo = new Map<string | undefined, unknown>();
    return ((arg?: string) => {
      if (!memo.has(arg)) memo.set(arg, fn(arg));
      return memo.get(arg);
    }) as T;
  },
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/infra/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

async function loadRequestContext() {
  vi.resetModules();
  const server = await import("@/infra/supabase/server");
  const admin = await import("@/infra/supabase/admin");
  const context = await import("./request-context");

  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
  vi.mocked(server.createSupabaseServerClient).mockResolvedValue({ auth: { getUser } } as never);

  const maybeSingle = vi.fn().mockResolvedValue({ data: { user_id: "admin-1" }, error: null });
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));
  vi.mocked(admin.createSupabaseAdminClient).mockReturnValue({ from } as never);

  return { ...context, getUser, from };
}

describe("request-context: memoizacion por peticion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isPlatformAdmin y requirePlatformAdmin comparten una sola lectura de sesion", async () => {
    const { isPlatformAdmin, requirePlatformAdmin, getUser } = await loadRequestContext();

    await expect(isPlatformAdmin()).resolves.toBe(true);
    await expect(requirePlatformAdmin()).resolves.toBe("admin-1");

    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("la consulta de platform_admins se hace una sola vez por usuario en la peticion", async () => {
    const { isPlatformAdmin, requirePlatformAdmin, from } = await loadRequestContext();

    await isPlatformAdmin();
    await requirePlatformAdmin();

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("platform_admins");
  });

  it("sin sesion isPlatformAdmin devuelve false sin consultar platform_admins", async () => {
    const { isPlatformAdmin, getUser, from } = await loadRequestContext();
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await expect(isPlatformAdmin()).resolves.toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
