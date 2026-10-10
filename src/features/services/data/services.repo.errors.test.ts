import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseDouble, type SupabaseDouble } from "@/test/small-features-supabase";
import { createService, updateService } from "./services.repo";

// Ramas de error de la comprobacion de categoria: si la consulta falla, el
// error original se propaga tal cual (no se sustituye por el mensaje de negocio).

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";

function useDb(script: Parameters<typeof createSupabaseDouble>[0] = {}): void {
  serverClient.current = createSupabaseDouble(script);
}

describe("services.repo: errores de la comprobacion de categoria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  it("createService propaga el error de la consulta de categoria sin insertar", async () => {
    const dbError = { message: "fallo al leer categorias" };
    useDb({ service_categories: { data: null, error: dbError } });

    await expect(
      createService(SALON_ID, { name: "Corte", category_id: "cat-1", duration_minutes: 30, price: 10 })
    ).rejects.toBe(dbError);
  });

  it("updateService propaga el error de la consulta de categoria cuando cambia la categoria", async () => {
    const dbError = { message: "fallo al leer categorias" };
    useDb({ service_categories: { data: null, error: dbError } });

    await expect(updateService("svc-1", SALON_ID, { category_id: "cat-2" })).rejects.toBe(dbError);
  });
});
