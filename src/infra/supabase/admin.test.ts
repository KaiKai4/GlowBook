import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ tag: "admin" })) }));
vi.mock("@/infra/config/env", () => ({
  getSupabasePublicEnv: () => ({ url: "https://proyecto.supabase.co", anonKey: "anon" }),
  getSupabaseServiceRoleKey: () => "service-role",
}));

// Cada test carga el modulo y el cliente de Supabase en un registro limpio, para
// que el singleton de cada test empiece vacio.
async function loadAdmin() {
  vi.resetModules();
  const supabase = await import("@supabase/supabase-js");
  const admin = await import("./admin");
  return { createClient: vi.mocked(supabase.createClient), createSupabaseAdminClient: admin.createSupabaseAdminClient };
}

describe("createSupabaseAdminClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea el cliente con la URL publica y la clave de servicio, sin persistir sesion", async () => {
    const { createClient, createSupabaseAdminClient } = await loadAdmin();

    createSupabaseAdminClient();

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith("https://proyecto.supabase.co", "service-role", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it("devuelve la misma instancia en llamadas sucesivas (singleton por modulo)", async () => {
    const { createClient, createSupabaseAdminClient } = await loadAdmin();

    const first = createSupabaseAdminClient();
    const second = createSupabaseAdminClient();

    expect(second).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});
