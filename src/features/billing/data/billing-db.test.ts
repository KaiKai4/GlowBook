import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  argsOf,
  createBillingSupabaseFake,
  firstQueryOn,
} from "@/test/billing-feature-supabase";
import { assertOk, billingDb, countRows, selectRows, selectWhere } from "./billing-db";

// Helpers de acceso a Supabase usados por todos los repositorios de billing:
// orden, filtros, normalización de null y propagación de errores.

const admin = vi.hoisted(() => ({ factory: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: admin.factory,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("billingDb", () => {
  it("devuelve el cliente admin (service_role) creado por la factoría", () => {
    const fake = createBillingSupabaseFake();
    admin.factory.mockReturnValueOnce(fake);

    expect(billingDb()).toBe(fake);
    expect(admin.factory).toHaveBeenCalledTimes(1);
  });
});

describe("selectRows", () => {
  it("pide las columnas indicadas y ordena ascendente por la columna dada", async () => {
    const fake = createBillingSupabaseFake({
      tables: { commercial_plans: { data: [{ id: "p1" }, { id: "p2" }], error: null } },
    });

    const rows = await selectRows<{ id: string }>(fake, "commercial_plans", "id, name", "sort_order");

    expect(rows).toEqual([{ id: "p1" }, { id: "p2" }]);
    const query = firstQueryOn(fake, "commercial_plans");
    expect(argsOf(query, "select")).toEqual(["id, name"]);
    expect(argsOf(query, "order")).toEqual(["sort_order", { ascending: true }]);
  });

  it("devuelve una lista vacía cuando la consulta no trae datos", async () => {
    const fake = createBillingSupabaseFake({
      tables: { commercial_plans: { data: null, error: null } },
    });

    expect(await selectRows(fake, "commercial_plans", "id", "sort_order")).toEqual([]);
  });

  it("lanza un Error con el mensaje de la base cuando la consulta falla", async () => {
    const fake = createBillingSupabaseFake({
      tables: { commercial_plans: { data: null, error: { message: "fallo de lectura" } } },
    });

    await expect(selectRows(fake, "commercial_plans", "id", "sort_order")).rejects.toThrow(
      "fallo de lectura"
    );
  });
});

describe("selectWhere", () => {
  it("filtra por la columna y el valor exactos pedidos", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        commercial_plan_limits: { data: [{ metric_key: "appointments_monthly" }], error: null },
      },
    });

    const rows = await selectWhere(fake, "commercial_plan_limits", "metric_key", "plan_id", "plan-1");

    expect(rows).toEqual([{ metric_key: "appointments_monthly" }]);
    const query = firstQueryOn(fake, "commercial_plan_limits");
    expect(argsOf(query, "select")).toEqual(["metric_key"]);
    expect(argsOf(query, "eq")).toEqual(["plan_id", "plan-1"]);
  });

  it("devuelve lista vacía sin datos y propaga el error de la consulta", async () => {
    const empty = createBillingSupabaseFake({ tables: { t: { data: null, error: null } } });
    expect(await selectWhere(empty, "t", "*", "plan_id", "x")).toEqual([]);

    const failing = createBillingSupabaseFake({
      tables: { t: { data: null, error: { message: "sin permiso" } } },
    });
    await expect(selectWhere(failing, "t", "*", "plan_id", "x")).rejects.toBeInstanceOf(Error);
  });
});

describe("countRows", () => {
  it("devuelve el conteo exacto de la consulta", async () => {
    const fake = createBillingSupabaseFake({
      tables: { salon_plan_alerts: { count: 7, error: null } },
    });

    const query = fake.from("salon_plan_alerts").select("*", { count: "exact", head: true });

    expect(await countRows(query)).toBe(7);
  });

  it("normaliza un conteo nulo a cero", async () => {
    const fake = createBillingSupabaseFake({
      tables: { salon_plan_alerts: { count: null, error: null } },
    });

    expect(await countRows(fake.from("salon_plan_alerts"))).toBe(0);
  });

  it("lanza un Error con el mensaje de la base cuando el conteo falla", async () => {
    const fake = createBillingSupabaseFake({
      tables: { salon_plan_alerts: { count: null, error: { message: "timeout" } } },
    });

    await expect(countRows(fake.from("salon_plan_alerts"))).rejects.toBeInstanceOf(Error);
  });
});

describe("assertOk", () => {
  it("resuelve sin valor cuando la escritura no reporta error", async () => {
    const fake = createBillingSupabaseFake({
      tables: { salon_plan_alerts: { data: null, error: null } },
    });

    await expect(
      assertOk(fake.from("salon_plan_alerts").update({ status: "resolved" }))
    ).resolves.toBeUndefined();
    expect(argsOf(firstQueryOn(fake, "salon_plan_alerts"), "update")).toEqual([
      { status: "resolved" },
    ]);
  });

  it("lanza un Error con el mensaje de la base cuando la escritura falla", async () => {
    const fake = createBillingSupabaseFake({
      tables: { salon_plan_alerts: { data: null, error: { message: "violación de constraint" } } },
    });

    await expect(assertOk(fake.from("salon_plan_alerts").delete())).rejects.toThrow(
      "violación de constraint"
    );
  });
});
