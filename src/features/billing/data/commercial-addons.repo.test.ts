import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabaseFrom, type FakeQueryResult } from "@/test/supabase-query-fake";
import { findCommercialAddonById, findCommercialAddons } from "./commercial-addons.repo";

// Verifica el mapeo de filas de base de datos (snake_case, numeric como texto)
// al modelo de dominio de extras comerciales.

const adminClient = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: () => adminClient.current }));

function useTables(tables: Record<string, FakeQueryResult>) {
  adminClient.current = fakeSupabaseFrom(tables);
}

const moduleRow = {
  id: "addon-1",
  code: "reportes",
  name: "Reportes",
  description: "Analítica avanzada",
  kind: "module",
  module_key: "reports",
  metric_key: null,
  limit_delta: null,
  currency: "USD",
  monthly_price: "12.50",
  status: "active",
  sort_order: 1,
};

const limitRow = {
  ...moduleRow,
  id: "addon-2",
  code: "clientes",
  kind: "limit_boost",
  module_key: null,
  metric_key: "customers_active",
  limit_delta: 50,
  monthly_price: 4,
  sort_order: 2,
};

describe("commercial-addons.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminClient.current = null;
  });

  it("findCommercialAddons convierte el precio a número y renombra las columnas", async () => {
    useTables({ commercial_addons: { data: [moduleRow, limitRow], error: null } });

    expect(await findCommercialAddons()).toEqual([
      {
        id: "addon-1",
        code: "reportes",
        name: "Reportes",
        description: "Analítica avanzada",
        kind: "module",
        moduleKey: "reports",
        metricKey: null,
        limitDelta: null,
        currency: "USD",
        monthlyPrice: 12.5,
        status: "active",
        sortOrder: 1,
      },
      expect.objectContaining({
        id: "addon-2",
        moduleKey: null,
        metricKey: "customers_active",
        limitDelta: 50,
        monthlyPrice: 4,
      }),
    ]);
  });

  it("findCommercialAddons propaga el error de la consulta", async () => {
    useTables({ commercial_addons: { data: null, error: { message: "permiso denegado" } } });

    await expect(findCommercialAddons()).rejects.toThrow("permiso denegado");
  });

  it("findCommercialAddonById devuelve null si el extra no existe", async () => {
    useTables({ commercial_addons: { data: null, error: null } });

    expect(await findCommercialAddonById("missing")).toBeNull();
  });

  it("findCommercialAddonById mapea el extra encontrado", async () => {
    useTables({ commercial_addons: { data: moduleRow, error: null } });

    expect(await findCommercialAddonById("addon-1")).toEqual(
      expect.objectContaining({ id: "addon-1", moduleKey: "reports", monthlyPrice: 12.5 })
    );
  });
});
