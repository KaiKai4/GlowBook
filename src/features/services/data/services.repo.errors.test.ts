import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseDouble, type SupabaseDouble } from "@/test/small-features-supabase";
import { findActiveServiceCategory } from "./services.repo";

// La consulta de categoria activa propaga el error original: el repositorio no
// traduce errores a mensajes de negocio (eso lo hace el caso de uso).

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";

function useDb(script: Parameters<typeof createSupabaseDouble>[0] = {}): void {
  serverClient.current = createSupabaseDouble(script);
}

describe("services.repo: errores de la consulta de categoria activa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  it("findActiveServiceCategory propaga el error de la consulta sin traducirlo", async () => {
    const dbError = { message: "fallo al leer categorias" };
    useDb({ service_categories: { data: null, error: dbError } });

    await expect(findActiveServiceCategory(SALON_ID, "cat-1")).rejects.toBe(dbError);
  });
});
