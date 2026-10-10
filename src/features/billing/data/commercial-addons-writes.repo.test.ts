import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  argsOf,
  createBillingSupabaseFake,
  type BillingSupabaseFake,
  firstQueryOn,
} from "@/test/billing-feature-supabase";
import {
  archiveCommercialAddon,
  countAddonAssignments,
  deleteCommercialAddon,
  saveCommercialAddon,
} from "./commercial-addons.repo";
import { issuePlatformAdminProof } from "@/infra/auth/platform-admin-proof";
const ADMIN_PROOF = issuePlatformAdminProof("admin-1");

// Escrituras de extras comerciales: insert/update con snake_case, archivado
// lógico frente a borrado, y conteo de asignaciones que decide entre ambos.

const admin = vi.hoisted(() => ({ factory: vi.fn() }));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: admin.factory,
}));

function useFake(fake: BillingSupabaseFake) {
  admin.factory.mockReturnValue(fake);
}

const addonValues = {
  code: "reportes",
  name: "Reportes",
  description: "Analítica avanzada",
  kind: "module" as const,
  moduleKey: "reports",
  metricKey: null,
  limitDelta: null,
  currency: "USD",
  monthlyPrice: 12.5,
  status: "active" as const,
  sortOrder: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveCommercialAddon", () => {
  it("inserta un extra nuevo con columnas snake_case y devuelve el id generado", async () => {
    const fake = createBillingSupabaseFake({
      tables: { commercial_addons: { data: { id: "addon-nuevo" }, error: null } },
    });
    useFake(fake);

    expect(await saveCommercialAddon(ADMIN_PROOF, addonValues)).toBe("addon-nuevo");

    const query = firstQueryOn(fake, "commercial_addons");
    expect(argsOf(query, "insert")?.[0]).toEqual({
      code: "reportes",
      name: "Reportes",
      description: "Analítica avanzada",
      kind: "module",
      module_key: "reports",
      metric_key: null,
      limit_delta: null,
      currency: "USD",
      monthly_price: 12.5,
      status: "active",
      sort_order: 3,
    });
    expect(argsOf(query, "select")).toEqual(["id"]);
    expect(argsOf(query, "update")).toBeUndefined();
  });

  it("actualiza el extra existente por id y devuelve ese mismo id", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    const id = await saveCommercialAddon(ADMIN_PROOF, {
      ...addonValues,
      id: "addon-1",
      kind: "limit_boost",
      moduleKey: null,
      metricKey: "customers_active",
      limitDelta: 50,
    });

    expect(id).toBe("addon-1");
    const query = firstQueryOn(fake, "commercial_addons");
    expect(argsOf(query, "insert")).toBeUndefined();
    expect(argsOf(query, "update")?.[0]).toEqual(
      expect.objectContaining({ kind: "limit_boost", metric_key: "customers_active", limit_delta: 50 })
    );
    expect(argsOf(query, "eq")).toEqual(["id", "addon-1"]);
  });

  it("lanza el mensaje propio cuando la inserción no devuelve fila", async () => {
    useFake(createBillingSupabaseFake({ tables: { commercial_addons: { data: null, error: null } } }));

    await expect(saveCommercialAddon(ADMIN_PROOF, addonValues)).rejects.toThrow("No se pudo crear el extra.");
  });

  it("propaga el error de la inserción y de la actualización", async () => {
    useFake(
      createBillingSupabaseFake({
        tables: { commercial_addons: { data: null, error: { message: "precio inválido" } } },
      })
    );

    await expect(saveCommercialAddon(ADMIN_PROOF, addonValues)).rejects.toBeInstanceOf(Error);
    await expect(saveCommercialAddon(ADMIN_PROOF, { ...addonValues, id: "addon-1" })).rejects.toBeInstanceOf(Error);
  });
});

describe("archiveCommercialAddon y deleteCommercialAddon", () => {
  it("archiva el extra cambiando su estado sin borrarlo", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await archiveCommercialAddon(ADMIN_PROOF, "addon-1");

    const query = firstQueryOn(fake, "commercial_addons");
    expect(argsOf(query, "update")).toEqual([{ status: "archived" }]);
    expect(argsOf(query, "eq")).toEqual(["id", "addon-1"]);
    expect(argsOf(query, "delete")).toBeUndefined();
  });

  it("borra el extra por id", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await deleteCommercialAddon(ADMIN_PROOF, "addon-1");

    const query = firstQueryOn(fake, "commercial_addons");
    expect(query.calls.map((call) => call.method)).toEqual(["delete", "eq"]);
    expect(argsOf(query, "eq")).toEqual(["id", "addon-1"]);
  });

  it("propaga el error de escritura al archivar o borrar", async () => {
    useFake(
      createBillingSupabaseFake({
        tables: { commercial_addons: { data: null, error: { message: "bloqueado" } } },
      })
    );

    await expect(archiveCommercialAddon(ADMIN_PROOF, "addon-1")).rejects.toBeInstanceOf(Error);
    await expect(deleteCommercialAddon(ADMIN_PROOF, "addon-1")).rejects.toBeInstanceOf(Error);
  });
});

describe("countAddonAssignments", () => {
  it("cuenta las sobreescripciones de salón que referencian el extra, sin traer filas", async () => {
    const fake = createBillingSupabaseFake({
      tables: { salon_plan_overrides: { count: 4, error: null } },
    });
    useFake(fake);

    expect(await countAddonAssignments(ADMIN_PROOF, "addon-1")).toBe(4);

    const query = firstQueryOn(fake, "salon_plan_overrides");
    expect(argsOf(query, "select")).toEqual(["*", { count: "exact", head: true }]);
    expect(argsOf(query, "eq")).toEqual(["addon_id", "addon-1"]);
  });

  it("devuelve cero cuando el conteo llega nulo y propaga errores", async () => {
    useFake(createBillingSupabaseFake({ tables: { salon_plan_overrides: { count: null, error: null } } }));
    expect(await countAddonAssignments(ADMIN_PROOF, "addon-1")).toBe(0);

    useFake(
      createBillingSupabaseFake({
        tables: { salon_plan_overrides: { count: null, error: { message: "timeout" } } },
      })
    );
    await expect(countAddonAssignments(ADMIN_PROOF, "addon-1")).rejects.toBeInstanceOf(Error);
  });
});
