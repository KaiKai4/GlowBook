import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  argsOf,
  createBillingSupabaseFake,
  firstQueryOn,
  queriesOn,
  type BillingSupabaseFake,
  type BillingSupabaseFakeOptions,
} from "@/test/billing-feature-supabase";
import {
  findEffectivePlanRowsForPlatform,
  findEffectivePlanRowsForSalon,
} from "./salon-subscriptions-reads.repo";
import { hasOpenPlanAlert, recordPlanAlert, updateSalonPlanOverrideStatus } from "./salon-subscriptions-writes.repo";

// Variantes de inquilino (cliente del usuario, RLS) frente a las de plataforma (service_role).
// Aquí se afirma qué cliente usa cada función y que las lecturas del salón no piden
// las columnas que la migración 073 no concede (reason, notes, price_override, is_gift).

const admin = vi.hoisted(() => ({ factory: vi.fn() }));
const server = vi.hoisted(() => ({ factory: vi.fn() }));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: admin.factory,
}));

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: server.factory,
}));

type TableMap = NonNullable<BillingSupabaseFakeOptions["tables"]>;

const SALON_ID = "00000000-0000-4000-8000-0000000000a1";
const NOW = "2026-10-09T12:00:00.000Z";
const TENANT_DENIED_COLUMNS = ["reason", "notes", "price_override", "is_gift"];

const planRow = {
  id: "plan-1",
  code: "basico",
  name: "Básico",
  description: "",
  currency: "USD",
  monthly_price: 20,
  trial_days: 0,
  status: "archived",
  is_public: false,
  sort_order: 1,
};

const assignmentRow = {
  id: "asg-1",
  salon_id: SALON_ID,
  plan_id: "plan-1",
  status: "active",
  starts_at: "2026-01-01",
  ends_at: null,
  trial_ends_at: null,
  current_period_start: null,
  current_period_end: null,
  notes: "nota interna",
};

const overrideRow = {
  id: "ov-1",
  salon_id: SALON_ID,
  module_key: null,
  metric_key: "employees_active",
  module_enabled: null,
  max_delta: 2,
  max_override: null,
  enforcement_mode: null,
  warning_threshold: null,
  reason: "motivo interno",
  starts_at: null,
  ends_at: null,
  status: "active",
  addon_id: null,
  quantity: 1,
  is_gift: true,
  price_override: 0,
};

const metricRow = {
  key: "employees_active",
  module_key: "employees",
  name: "Empleados activos",
  description: "",
  unit: "unidades",
  counter_key: "employees_active",
  default_count_scope: "current",
  is_active: true,
  is_archived: false,
  sort_order: 1,
};

function tenantTables(overrides: TableMap = {}): TableMap {
  return {
    commercial_limit_metrics: { data: [metricRow], error: null },
    salon_plan_assignments: { data: [assignmentRow], error: null },
    commercial_plans: { data: [planRow], error: null },
    commercial_plan_modules: { data: [], error: null },
    commercial_plan_limits: { data: [], error: null },
    salon_plan_overrides: { data: [overrideRow], error: null },
    ...overrides,
  };
}

function selectedColumns(fake: BillingSupabaseFake, table: string): string {
  const selected = argsOf(firstQueryOn(fake, table), "select")?.[0];
  if (typeof selected !== "string") throw new Error(`Sin columnas seleccionadas en ${table}`);
  return selected;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("findEffectivePlanRowsForSalon: lecturas con la sesión del usuario (RLS)", () => {
  it("usa el cliente de sesión y no service_role", async () => {
    const session = createBillingSupabaseFake({ tables: tenantTables() });
    server.factory.mockResolvedValue(session);

    await findEffectivePlanRowsForSalon(SALON_ID);

    expect(server.factory).toHaveBeenCalled();
    expect(admin.factory).not.toHaveBeenCalled();
    expect(queriesOn(session, "salon_plan_assignments").length).toBeGreaterThan(0);
  });

  it("no pide columnas que el salón no puede leer", async () => {
    const session = createBillingSupabaseFake({ tables: tenantTables() });
    server.factory.mockResolvedValue(session);

    await findEffectivePlanRowsForSalon(SALON_ID);

    for (const table of ["salon_plan_assignments", "salon_plan_overrides"]) {
      const columns = selectedColumns(session, table);
      for (const denied of TENANT_DENIED_COLUMNS) {
        expect(columns.split(", ")).not.toContain(denied);
      }
    }
  });

  it("filtra asignación y overrides por el salón indicado y devuelve el plan asignado", async () => {
    const session = createBillingSupabaseFake({ tables: tenantTables() });
    server.factory.mockResolvedValue(session);

    const rows = await findEffectivePlanRowsForSalon(SALON_ID);

    expect(argsOf(firstQueryOn(session, "salon_plan_assignments"), "eq")).toEqual(["salon_id", SALON_ID]);
    expect(argsOf(firstQueryOn(session, "salon_plan_overrides"), "eq")).toEqual(["salon_id", SALON_ID]);
    expect(rows.plan?.id).toBe("plan-1");
    expect(rows.assignment?.status).toBe("active");
    expect(rows.overrides.map((override) => override.id)).toEqual(["ov-1"]);
    expect(rows.overrides[0]).not.toHaveProperty("reason");
    expect(rows.overrides[0]).not.toHaveProperty("isGift");
    expect(rows.overrides[0]).not.toHaveProperty("priceOverride");
  });

  it("no expone la nota interna de la asignación", async () => {
    server.factory.mockResolvedValue(createBillingSupabaseFake({ tables: tenantTables() }));

    const rows = await findEffectivePlanRowsForSalon(SALON_ID);

    expect(rows.assignment).not.toHaveProperty("notes");
  });
});

describe("findEffectivePlanRowsForPlatform: lecturas de plataforma (service_role)", () => {
  it("usa service_role con columnas completas", async () => {
    const admins: BillingSupabaseFakeOptions = { tables: tenantTables() };
    const fake = createBillingSupabaseFake(admins);
    admin.factory.mockReturnValue(fake);

    const rows = await findEffectivePlanRowsForPlatform(SALON_ID);

    expect(server.factory).not.toHaveBeenCalled();
    expect(selectedColumns(fake, "salon_plan_assignments")).toContain("notes");
    expect(selectedColumns(fake, "salon_plan_overrides")).toContain("reason");
    expect(rows.overrides[0]?.reason).toBe("motivo interno");
  });
});

describe("hasOpenPlanAlert: lectura del salón con RLS", () => {
  it("cuenta con la sesión del usuario las alertas abiertas de la métrica", async () => {
    const session = createBillingSupabaseFake({ tables: { salon_plan_alerts: { count: 1, error: null } } });
    server.factory.mockResolvedValue(session);

    expect(await hasOpenPlanAlert(SALON_ID, "employees_active")).toBe(true);

    const query = firstQueryOn(session, "salon_plan_alerts");
    expect(query.calls.filter((call) => call.method === "eq").map((call) => call.args)).toEqual([
      ["salon_id", SALON_ID],
      ["metric_key", "employees_active"],
      ["status", "open"],
    ]);
    expect(admin.factory).not.toHaveBeenCalled();
  });

  it("devuelve false sin alertas abiertas", async () => {
    server.factory.mockResolvedValue(createBillingSupabaseFake({ tables: { salon_plan_alerts: { count: 0, error: null } } }));

    expect(await hasOpenPlanAlert(SALON_ID, "employees_active")).toBe(false);
  });
});

describe("recordPlanAlert: RPC con la sesión del usuario", () => {
  it("llama a record_plan_alert sin enviar salon_id", async () => {
    const session = createBillingSupabaseFake();
    server.factory.mockResolvedValue(session);

    await recordPlanAlert({
      planId: "plan-1",
      metricKey: "employees_active",
      moduleKey: "employees",
      severity: "danger",
      message: "Límite superado",
    });

    const rpc = firstQueryOn(session, "rpc:record_plan_alert");
    expect(argsOf(rpc, "rpc")?.[0]).toEqual({
      p_plan_id: "plan-1",
      p_metric_key: "employees_active",
      p_module_key: "employees",
      p_severity: "danger",
      p_message: "Límite superado",
    });
    expect(session.rpc).toHaveBeenCalledTimes(1);
    expect(admin.factory).not.toHaveBeenCalled();
  });

  it("propaga el error de la RPC (por ejemplo, sesión sin salón)", async () => {
    server.factory.mockResolvedValue(
      createBillingSupabaseFake({ rpc: { error: { message: "La sesión no tiene salón" } } })
    );

    await expect(
      recordPlanAlert({
        planId: "plan-1",
        metricKey: "employees_active",
        moduleKey: "employees",
        severity: "info",
        message: "x",
      })
    ).rejects.toThrow("La sesión no tiene salón");
  });
});

describe("escrituras de plataforma sobre overrides: salón y una sola fila", () => {
  it("updateSalonPlanOverrideStatus falla si la sobreescritura no es del salón (cero filas)", async () => {
    admin.factory.mockReturnValue(
      createBillingSupabaseFake({ tables: { salon_plan_overrides: { data: [], error: null } } })
    );

    await expect(updateSalonPlanOverrideStatus(SALON_ID, "ov-ajeno", "canceled")).rejects.toThrow(
      "se actualizaron 0"
    );
  });
});
