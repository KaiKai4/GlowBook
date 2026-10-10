import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { isPlatformAdminUser, readSessionUserId } from "./session";

vi.mock("server-only", () => ({}));
vi.mock("@/infra/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

const getUser = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser } } as never);
});

describe("readSessionUserId", () => {
  it("devuelve el id del usuario de la sesion", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    await expect(readSessionUserId()).resolves.toBe("u1");
  });

  it("sin sesion abierta devuelve null", async () => {
    const missing = Object.assign(new Error("Auth session missing!"), { name: "AuthSessionMissingError", status: 400 });
    getUser.mockResolvedValue({ data: { user: null }, error: missing });

    await expect(readSessionUserId()).resolves.toBeNull();
  });

  it.each([
    ["JWT invalido o caducado (401)", "invalid JWT", 401],
    ["usuario del claim sub inexistente (403)", "User from sub claim in JWT does not exist", 403],
  ])("error de auth del cliente %s devuelve null para mandar a login", async (_label, message, status) => {
    const authError = Object.assign(new Error(message), { name: "AuthApiError", status });
    getUser.mockResolvedValue({ data: { user: null }, error: authError });

    await expect(readSessionUserId()).resolves.toBeNull();
  });

  it("un 500 del servicio de auth se lanza como fallo de infraestructura", async () => {
    const serverError = Object.assign(new Error("internal"), { name: "AuthApiError", status: 500 });
    getUser.mockResolvedValue({ data: { user: null }, error: serverError });

    await expect(readSessionUserId()).rejects.toBe(serverError);
  });

  it("propaga los errores de BD o de red en vez de tratarlos como sin sesion", async () => {
    const networkError = Object.assign(new Error("fetch failed"), { name: "AuthRetryableFetchError" });
    getUser.mockResolvedValue({ data: { user: null }, error: networkError });

    await expect(readSessionUserId()).rejects.toBe(networkError);
  });
});

describe("isPlatformAdminUser", () => {
  function adminWith(result: { data: unknown; error: unknown }) {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue(result),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => query) } as never);
  }

  it("indica si el usuario figura en platform_admins", async () => {
    adminWith({ data: { user_id: "u1" }, error: null });
    await expect(isPlatformAdminUser("u1")).resolves.toBe(true);

    adminWith({ data: null, error: null });
    await expect(isPlatformAdminUser("u1")).resolves.toBe(false);
  });

  it("propaga el error de BD en vez de devolver false", async () => {
    const dbError = { message: "permission denied", code: "42501" };
    adminWith({ data: null, error: dbError });

    await expect(isPlatformAdminUser("u1")).rejects.toBe(dbError);
  });
});
