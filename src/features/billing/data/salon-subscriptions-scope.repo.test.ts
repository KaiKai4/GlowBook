import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  argsOf,
  createBillingSupabaseFake,
  queriesOn,
  type BillingSupabaseFake,
  type BillingSupabaseFakeOptions,
  firstQueryOn,
} from "@/test/billing-feature-supabase";
import {
  activatePaidPeriod,
  assignSalonPlan,
  findAssignmentForPayment,
  findAssignmentStartsAt,
  findEffectivePlanRows,
  findOpenSalonAlerts,
  findSalonPayments,
  hasOpenPlanAlert,
  recordPlanAlert,
  recordSalonPlanPayment,
  resolvePlanAlert,
  saveSalonPlanOverride,
  updateSalonPlanOverrideStatus,
} from "./salon-subscriptions.repo";

// Repositorio de suscripciones de salón. Es cross-tenant (service_role), así que
// cada consulta que toca datos de un salón debe filtrar por salon_id de forma
// explícita. Aquí se afirma ese filtro, las columnas y la ventana de uso que se
// envía a la RPC count_salon_usage.

const admin = vi.hoisted(() => ({ factory: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: admin.factory,
}));

type TableMap = NonNullable<BillingSupabaseFakeOptions["tables"]>;

const SALON_ID = "00000000-0000-4000-8000-0000000000a1";
const OTHER_SALON_ID = "00000000-0000-4000-8000-0000000000a2";
const NOW = "2026-10-09T12:00:00.000Z";

function useFake(fake: BillingSupabaseFake) {
  admin.factory.mockReturnValue(fake);
}

const metricRow = (key: string, scope: string, counter: string, moduleKey: string) => ({
  key,
  module_key: moduleKey,
  name: key,
  description: "",
  unit: "unidades",
  counter_key: counter,
  default_count_scope: scope,
  is_active: true,
  is_archived: false,
  sort_order: 1,
});

const assignmentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "asg-1",
  salon_id: SALON_ID,
  plan_id: "plan-1",
  status: "active",
  starts_at: "2026-01-01",
  ends_at: null,
  trial_ends_at: null,
  current_period_start: null,
  current_period_end: null,
  notes: "",
  ...overrides,
});

const planRow = {
  id: "plan-1",
  code: "basico",
  name: "Básico",
  description: "",
  currency: "USD",
  monthly_price: 20,
  trial_days: 0,
  status: "active",
  is_public: true,
  sort_order: 1,
};

function usageCall(fake: BillingSupabaseFake) {
  const rpc = firstQueryOn(fake, "rpc:count_salon_usage");
  const params = argsOf(rpc, "rpc")?.[0] as
    | { p_salon_id: string; p_counters: Array<{ key: string; counter: string; from: string | null; to: string | null }> }
    | undefined;
  return params;
}

function countersByKey(fake: BillingSupabaseFake) {
  const params = usageCall(fake);
  return Object.fromEntries((params?.p_counters ?? []).map((counter) => [counter.key, counter]));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("findEffectivePlanRows: aislamiento y filtros del salón", () => {
  function baseTables(overrides: TableMap = {}): TableMap {
    return {
      commercial_limit_metrics: {
        data: [
          metricRow("appointments_monthly", "monthly", "appointments_total", "appointments"),
          metricRow("employees_active", "current", "employees_active", "employees"),
        ],
        error: null,
      },
      salon_plan_assignments: { data: assignmentRow(), error: null },
      commercial_plans: { data: planRow, error: null },
      commercial_plan_modules: { data: [], error: null },
      commercial_plan_limits: { data: [], error: null },
      salon_plan_overrides: { data: [], error: null },
      ...overrides,
    };
  }

  it("busca la asignación vigente solo de ese salón y estados que consumen plan", async () => {
    const fake = createBillingSupabaseFake({ tables: baseTables() });
    useFake(fake);

    await findEffectivePlanRows(SALON_ID);

    const assignmentQuery = firstQueryOn(fake, "salon_plan_assignments");
    expect(argsOf(assignmentQuery, "eq")).toEqual(["salon_id", SALON_ID]);
    expect(argsOf(assignmentQuery, "in")).toEqual([
      "status",
      ["trialing", "active", "past_due", "paused"],
    ]);
    expect(argsOf(assignmentQuery, "order")).toEqual(["created_at", { ascending: false }]);
    expect(argsOf(assignmentQuery, "limit")).toEqual([1]);
  });

  it("filtra overrides por salón y descarta los pausados, cancelados o fuera de fechas", async () => {
    const overrideRow = (id: string, partial: Record<string, unknown>) => ({
      id,
      salon_id: SALON_ID,
      module_key: null,
      metric_key: "employees_active",
      module_enabled: null,
      max_delta: 2,
      max_override: null,
      enforcement_mode: null,
      warning_threshold: null,
      reason: "",
      starts_at: null,
      ends_at: null,
      status: "active",
      addon_id: null,
      quantity: 1,
      is_gift: false,
      price_override: null,
      ...partial,
    });
    const fake = createBillingSupabaseFake({
      tables: baseTables({
        salon_plan_overrides: {
          data: [
            overrideRow("vigente", {}),
            overrideRow("empieza-hoy", { starts_at: "2026-10-09" }),
            overrideRow("termina-hoy", { ends_at: "2026-10-09" }),
            overrideRow("futuro", { starts_at: "2026-11-01" }),
            overrideRow("vencido", { ends_at: "2026-10-08" }),
            overrideRow("pausado", { status: "paused" }),
            overrideRow("cancelado", { status: "canceled" }),
          ],
          error: null,
        },
      }),
    });
    useFake(fake);

    const rows = await findEffectivePlanRows(SALON_ID);

    expect(rows.overrides.map((override) => override.id)).toEqual([
      "vigente",
      "empieza-hoy",
      "termina-hoy",
    ]);
    const overridesQuery = firstQueryOn(fake, "salon_plan_overrides");
    expect(argsOf(overridesQuery, "eq")).toEqual(["salon_id", SALON_ID]);
  });

  it("devuelve sin plan y sin consultar el plan ni la RPC de uso cuando no hay asignación", async () => {
    const fake = createBillingSupabaseFake({
      tables: baseTables({ salon_plan_assignments: { data: null, error: null } }),
    });
    useFake(fake);

    const rows = await findEffectivePlanRows(SALON_ID);

    expect(rows.assignment).toBeNull();
    expect(rows.plan).toBeNull();
    expect(queriesOn(fake, "commercial_plans")).toHaveLength(0);
    // Sin plan, cada métrica se cuenta con su ventana por defecto.
    expect(usageCall(fake)?.p_salon_id).toBe(SALON_ID);
    expect(rows.usage).toEqual({ appointments_monthly: 0, employees_active: 0 });
  });

  it("consulta el plan de la asignación y envía el salón a la RPC de conteo", async () => {
    const fake = createBillingSupabaseFake({
      tables: baseTables({
        commercial_plan_modules: {
          data: [{ plan_id: "plan-1", module_key: "appointments", enabled: true }],
          error: null,
        },
      }),
      rpc: { data: { appointments_monthly: "5", employees_active: 2 }, error: null },
    });
    useFake(fake);

    const rows = await findEffectivePlanRows(SALON_ID);

    expect(argsOf(firstQueryOn(fake, "commercial_plans"), "eq")).toEqual(["id", "plan-1"]);
    expect(usageCall(fake)?.p_salon_id).toBe(SALON_ID);
    expect(rows.plan?.modules).toEqual([{ moduleKey: "appointments", enabled: true }]);
    expect(rows.usage).toEqual({ appointments_monthly: 5, employees_active: 2 });
  });

  it("normaliza a cero los conteos que la RPC no devuelve", async () => {
    const fake = createBillingSupabaseFake({
      tables: baseTables(),
      rpc: { data: { appointments_monthly: 3 }, error: null },
    });
    useFake(fake);

    const rows = await findEffectivePlanRows(SALON_ID);

    expect(rows.usage).toEqual({ appointments_monthly: 3, employees_active: 0 });
  });

  it("no llama a la RPC cuando no hay métricas activas", async () => {
    const fake = createBillingSupabaseFake({
      tables: baseTables({ commercial_limit_metrics: { data: [], error: null } }),
    });
    useFake(fake);

    const rows = await findEffectivePlanRows(SALON_ID);

    expect(rows.usage).toEqual({});
    expect(queriesOn(fake, "rpc:count_salon_usage")).toHaveLength(0);
  });

  it("lanza el error de la RPC de conteo", async () => {
    const fake = createBillingSupabaseFake({
      tables: baseTables(),
      rpc: { data: null, error: { message: "rpc caída" } },
    });
    useFake(fake);

    await expect(findEffectivePlanRows(SALON_ID)).rejects.toBeInstanceOf(Error);
  });

  it("lanza el error de la consulta de asignación", async () => {
    const fake = createBillingSupabaseFake({
      tables: baseTables({ salon_plan_assignments: { data: null, error: { message: "sin acceso" } } }),
    });
    useFake(fake);

    await expect(findEffectivePlanRows(SALON_ID)).rejects.toBeInstanceOf(Error);
  });
});

describe("findEffectivePlanRows: ventanas de conteo enviadas a la RPC", () => {
  it("cuenta el mes calendario en UTC para alcances mensuales", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        commercial_limit_metrics: {
          data: [metricRow("appointments_monthly", "monthly", "appointments_total", "appointments")],
          error: null,
        },
        salon_plan_assignments: { data: null, error: null },
      },
    });
    useFake(fake);

    await findEffectivePlanRows(SALON_ID);

    expect(countersByKey(fake).appointments_monthly).toEqual({
      key: "appointments_monthly",
      counter: "appointments_total",
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-11-01T00:00:00.000Z",
    });
  });

  it("no acota el conteo para alcances current y lifetime", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        commercial_limit_metrics: {
          data: [metricRow("employees_active", "current", "employees_active", "employees")],
          error: null,
        },
        salon_plan_assignments: { data: null, error: null },
      },
    });
    useFake(fake);

    await findEffectivePlanRows(SALON_ID);

    expect(countersByKey(fake).employees_active).toMatchObject({ from: null, to: null });
  });

  it("el alcance del límite del plan prevalece sobre el alcance por defecto de la métrica", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        commercial_limit_metrics: {
          data: [metricRow("appointments_monthly", "monthly", "appointments_total", "appointments")],
          error: null,
        },
        salon_plan_assignments: { data: assignmentRow(), error: null },
        commercial_plans: { data: planRow, error: null },
        commercial_plan_limits: {
          data: [
            {
              plan_id: "plan-1",
              metric_key: "appointments_monthly",
              max_value: 100,
              enforcement_mode: "block",
              warning_threshold: 80,
              count_scope: "lifetime",
            },
          ],
          error: null,
        },
      },
    });
    useFake(fake);

    await findEffectivePlanRows(SALON_ID);

    expect(countersByKey(fake).appointments_monthly).toMatchObject({ from: null, to: null });
  });

  it("usa el periodo pagado como ventana de ciclo cuando la plataforma registró un pago", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        commercial_limit_metrics: {
          data: [metricRow("appointments_monthly", "billing_cycle", "appointments_total", "appointments")],
          error: null,
        },
        salon_plan_assignments: {
          data: assignmentRow({
            starts_at: "2026-03-15",
            current_period_start: "2026-10-05",
            current_period_end: "2026-11-05",
          }),
          error: null,
        },
      },
    });
    useFake(fake);

    await findEffectivePlanRows(SALON_ID);

    expect(countersByKey(fake).appointments_monthly).toMatchObject({
      from: "2026-10-05T00:00:00.000Z",
      to: "2026-11-05T00:00:00.000Z",
    });
  });

  it("ancla el ciclo de facturación al día de inicio cuando no hay periodo pagado", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        commercial_limit_metrics: {
          data: [metricRow("appointments_monthly", "billing_cycle", "appointments_total", "appointments")],
          error: null,
        },
        salon_plan_assignments: { data: assignmentRow({ starts_at: "2026-03-15" }), error: null },
      },
    });
    useFake(fake);

    await findEffectivePlanRows(SALON_ID);

    // Hoy 9 de octubre es antes del día 15: el ciclo vigente arranco el 15 de septiembre.
    expect(countersByKey(fake).appointments_monthly).toMatchObject({
      from: "2026-09-15T00:00:00.000Z",
      to: "2026-10-15T00:00:00.000Z",
    });
  });

  it("el ciclo anclado avanza al mes siguiente una vez pasado el día de inicio", async () => {
    vi.setSystemTime(new Date("2026-10-20T08:00:00.000Z"));
    const fake = createBillingSupabaseFake({
      tables: {
        commercial_limit_metrics: {
          data: [metricRow("appointments_monthly", "billing_cycle", "appointments_total", "appointments")],
          error: null,
        },
        salon_plan_assignments: { data: assignmentRow({ starts_at: "2026-03-15" }), error: null },
      },
    });
    useFake(fake);

    await findEffectivePlanRows(SALON_ID);

    expect(countersByKey(fake).appointments_monthly).toMatchObject({
      from: "2026-10-15T00:00:00.000Z",
      to: "2026-11-15T00:00:00.000Z",
    });
  });

  it("cruza el año al anclar el ciclo en diciembre", async () => {
    vi.setSystemTime(new Date("2026-01-10T12:00:00.000Z"));
    const fake = createBillingSupabaseFake({
      tables: {
        commercial_limit_metrics: {
          data: [metricRow("appointments_monthly", "billing_cycle", "appointments_total", "appointments")],
          error: null,
        },
        salon_plan_assignments: { data: assignmentRow({ starts_at: "2025-12-20" }), error: null },
      },
    });
    useFake(fake);

    await findEffectivePlanRows(SALON_ID);

    expect(countersByKey(fake).appointments_monthly).toMatchObject({
      from: "2025-12-20T00:00:00.000Z",
      to: "2026-01-20T00:00:00.000Z",
    });
  });

  it("recorta el día ancla al último día de meses cortos", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        commercial_limit_metrics: {
          data: [metricRow("appointments_monthly", "billing_cycle", "appointments_total", "appointments")],
          error: null,
        },
        salon_plan_assignments: { data: assignmentRow({ starts_at: "2026-01-31" }), error: null },
      },
    });
    useFake(fake);

    await findEffectivePlanRows(SALON_ID);

    // Día ancla 31: en septiembre (30 días) cae el 30; el siguiente corte es el 31 de octubre.
    expect(countersByKey(fake).appointments_monthly).toMatchObject({
      from: "2026-09-30T00:00:00.000Z",
      to: "2026-10-31T00:00:00.000Z",
    });
  });

  it("usa el mes calendario para ciclo de facturación sin fecha de inicio", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        commercial_limit_metrics: {
          data: [metricRow("appointments_monthly", "billing_cycle", "appointments_total", "appointments")],
          error: null,
        },
        salon_plan_assignments: { data: assignmentRow({ starts_at: null }), error: null },
      },
    });
    useFake(fake);

    await findEffectivePlanRows(SALON_ID);

    expect(countersByKey(fake).appointments_monthly).toMatchObject({
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-11-01T00:00:00.000Z",
    });
  });
});

describe("lecturas por salón", () => {
  it("findAssignmentStartsAt filtra por salón y devuelve null si no hay asignación", async () => {
    const fake = createBillingSupabaseFake({
      tables: { salon_plan_assignments: { data: { starts_at: "2026-02-01" }, error: null } },
    });
    useFake(fake);

    expect(await findAssignmentStartsAt(SALON_ID)).toBe("2026-02-01");
    const query = firstQueryOn(fake, "salon_plan_assignments");
    expect(argsOf(query, "select")).toEqual(["starts_at"]);
    expect(argsOf(query, "eq")).toEqual(["salon_id", SALON_ID]);

    useFake(createBillingSupabaseFake({ tables: { salon_plan_assignments: { data: null, error: null } } }));
    expect(await findAssignmentStartsAt(OTHER_SALON_ID)).toBeNull();
  });

  it("findAssignmentForPayment devuelve plan y fin de periodo del salón indicado", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        salon_plan_assignments: {
          data: { plan_id: "plan-1", current_period_end: "2026-11-05" },
          error: null,
        },
      },
    });
    useFake(fake);

    expect(await findAssignmentForPayment(SALON_ID)).toEqual({
      plan_id: "plan-1",
      current_period_end: "2026-11-05",
    });
    const query = firstQueryOn(fake, "salon_plan_assignments");
    expect(argsOf(query, "eq")).toEqual(["salon_id", SALON_ID]);
    expect(argsOf(query, "select")).toEqual(["plan_id, current_period_end"]);
  });

  it("findAssignmentForPayment propaga el error de lectura", async () => {
    useFake(
      createBillingSupabaseFake({
        tables: { salon_plan_assignments: { data: null, error: { message: "sin acceso" } } },
      })
    );

    await expect(findAssignmentForPayment(SALON_ID)).rejects.toBeInstanceOf(Error);
  });

  it("findSalonPayments pide los últimos 12 pagos del salón, más recientes primero", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        salon_plan_payments: {
          data: [{ id: "pay-2", salon_id: SALON_ID, amount: "20.00" }],
          error: null,
        },
      },
    });
    useFake(fake);

    const payments = await findSalonPayments(SALON_ID);

    expect(payments).toEqual([{ id: "pay-2", salon_id: SALON_ID, amount: "20.00" }]);
    const query = firstQueryOn(fake, "salon_plan_payments");
    expect(argsOf(query, "eq")).toEqual(["salon_id", SALON_ID]);
    expect(argsOf(query, "order")).toEqual(["paid_at", { ascending: false }]);
    expect(argsOf(query, "limit")).toEqual([12]);
  });

  it("findSalonPayments respeta un límite explícito y normaliza nulos a lista vacía", async () => {
    const fake = createBillingSupabaseFake({
      tables: { salon_plan_payments: { data: null, error: null } },
    });
    useFake(fake);

    expect(await findSalonPayments(SALON_ID, 3)).toEqual([]);
    expect(argsOf(firstQueryOn(fake, "salon_plan_payments"), "limit")).toEqual([3]);
  });

  it("findSalonPayments propaga el error de lectura", async () => {
    useFake(
      createBillingSupabaseFake({
        tables: { salon_plan_payments: { data: null, error: { message: "timeout" } } },
      })
    );

    await expect(findSalonPayments(SALON_ID)).rejects.toBeInstanceOf(Error);
  });

  it("findOpenSalonAlerts pide solo alertas abiertas del salón, las 20 más recientes", async () => {
    const fake = createBillingSupabaseFake({
      tables: { salon_plan_alerts: { data: [{ id: "al-1" }], error: null } },
    });
    useFake(fake);

    expect(await findOpenSalonAlerts(SALON_ID)).toEqual([{ id: "al-1" }]);
    const query = firstQueryOn(fake, "salon_plan_alerts");
    expect(argsOf(query, "eq")).toEqual(["salon_id", SALON_ID]);
    expect(argsOf(query, "order")).toEqual(["created_at", { ascending: false }]);
    expect(argsOf(query, "limit")).toEqual([20]);
  });

  it("findOpenSalonAlerts normaliza nulos y propaga errores", async () => {
    useFake(createBillingSupabaseFake({ tables: { salon_plan_alerts: { data: null, error: null } } }));
    expect(await findOpenSalonAlerts(SALON_ID)).toEqual([]);

    useFake(
      createBillingSupabaseFake({
        tables: { salon_plan_alerts: { data: null, error: { message: "sin acceso" } } },
      })
    );
    await expect(findOpenSalonAlerts(SALON_ID)).rejects.toBeInstanceOf(Error);
  });

  it("hasOpenPlanAlert cuenta alertas abiertas del salón y métrica", async () => {
    const fake = createBillingSupabaseFake({
      tables: { salon_plan_alerts: { count: 1, error: null } },
    });
    useFake(fake);

    expect(await hasOpenPlanAlert(SALON_ID, "appointments_monthly")).toBe(true);
    const query = firstQueryOn(fake, "salon_plan_alerts");
    expect(argsOf(query, "eq")).toEqual(["salon_id", SALON_ID]);
    expect(query.calls.filter((call) => call.method === "eq").map((call) => call.args)).toEqual([
      ["salon_id", SALON_ID],
      ["metric_key", "appointments_monthly"],
      ["status", "open"],
    ]);
  });

  it("hasOpenPlanAlert devuelve false sin alertas abiertas", async () => {
    useFake(createBillingSupabaseFake({ tables: { salon_plan_alerts: { count: 0, error: null } } }));

    expect(await hasOpenPlanAlert(SALON_ID, "appointments_monthly")).toBe(false);
  });
});

describe("escrituras por salón", () => {
  it("assignSalonPlan hace upsert por salon_id con las fechas derivadas", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await assignSalonPlan({
      salonId: SALON_ID,
      planId: "plan-1",
      status: "trialing",
      startsAt: "2026-10-09",
      endsAt: null,
      trialEndsAt: "2026-10-23",
      notes: "Prueba",
    });

    const query = firstQueryOn(fake, "salon_plan_assignments");
    expect(argsOf(query, "upsert")).toEqual([
      {
        salon_id: SALON_ID,
        plan_id: "plan-1",
        status: "trialing",
        starts_at: "2026-10-09",
        ends_at: null,
        trial_ends_at: "2026-10-23",
        notes: "Prueba",
      },
      { onConflict: "salon_id" },
    ]);
  });

  it("activatePaidPeriod activa solo la asignación del salón indicado", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await activatePaidPeriod({ salonId: SALON_ID, periodStart: "2026-10-09", periodEnd: "2026-11-09" });

    const query = firstQueryOn(fake, "salon_plan_assignments");
    expect(argsOf(query, "update")).toEqual([
      { status: "active", current_period_start: "2026-10-09", current_period_end: "2026-11-09" },
    ]);
    expect(argsOf(query, "eq")).toEqual(["salon_id", SALON_ID]);
  });

  it("recordSalonPlanPayment inserta el pago con el salón y el periodo cubierto", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await recordSalonPlanPayment({
      salonId: SALON_ID,
      planId: "plan-1",
      amount: 20,
      currency: "USD",
      paidAt: "2026-10-09",
      periodStart: "2026-10-09",
      periodEnd: "2026-11-09",
      notes: "Transferencia",
    });

    const query = firstQueryOn(fake, "salon_plan_payments");
    expect(argsOf(query, "insert")?.[0]).toEqual({
      salon_id: SALON_ID,
      plan_id: "plan-1",
      amount: 20,
      currency: "USD",
      paid_at: "2026-10-09",
      period_start: "2026-10-09",
      period_end: "2026-11-09",
      notes: "Transferencia",
    });
  });

  it("saveSalonPlanOverride inserta la sobreescritura con el salón y los campos snake_case", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await saveSalonPlanOverride({
      salonId: SALON_ID,
      moduleKey: null,
      metricKey: "employees_active",
      moduleEnabled: null,
      maxDelta: 2,
      maxOverride: null,
      enforcementMode: "warn",
      warningThreshold: 70,
      reason: "Cortesía",
      startsAt: null,
      endsAt: "2026-12-31",
      status: "active",
      addonId: "addon-1",
      quantity: 2,
      isGift: false,
      priceOverride: 5,
    });

    const query = firstQueryOn(fake, "salon_plan_overrides");
    expect(argsOf(query, "insert")?.[0]).toEqual({
      salon_id: SALON_ID,
      module_key: null,
      metric_key: "employees_active",
      module_enabled: null,
      max_delta: 2,
      max_override: null,
      enforcement_mode: "warn",
      warning_threshold: 70,
      reason: "Cortesía",
      starts_at: null,
      ends_at: "2026-12-31",
      status: "active",
      addon_id: "addon-1",
      quantity: 2,
      is_gift: false,
      price_override: 5,
    });
  });

  it("updateSalonPlanOverrideStatus cambia el estado de una sola sobreescritura por id", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await updateSalonPlanOverrideStatus("ov-1", "paused");

    const query = firstQueryOn(fake, "salon_plan_overrides");
    expect(argsOf(query, "update")).toEqual([{ status: "paused" }]);
    expect(argsOf(query, "eq")).toEqual(["id", "ov-1"]);
  });

  it("recordPlanAlert inserta la alerta con el salón y la métrica", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await recordPlanAlert({
      salonId: SALON_ID,
      planId: "plan-1",
      metricKey: "employees_active",
      moduleKey: "employees",
      severity: "danger",
      message: "Límite superado",
    });

    const query = firstQueryOn(fake, "salon_plan_alerts");
    expect(argsOf(query, "insert")?.[0]).toEqual({
      salon_id: SALON_ID,
      plan_id: "plan-1",
      metric_key: "employees_active",
      module_key: "employees",
      severity: "danger",
      message: "Límite superado",
    });
  });

  it("resolvePlanAlert marca la alerta como resuelta por id", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await resolvePlanAlert("al-1");

    const query = firstQueryOn(fake, "salon_plan_alerts");
    expect(argsOf(query, "update")).toEqual([{ status: "resolved" }]);
    expect(argsOf(query, "eq")).toEqual(["id", "al-1"]);
  });

  it("propaga los errores de escritura de cada operación", async () => {
    useFake(
      createBillingSupabaseFake({
        tables: {
          salon_plan_assignments: { data: null, error: { message: "upsert rechazado" } },
          salon_plan_payments: { data: null, error: { message: "pago rechazado" } },
          salon_plan_overrides: { data: null, error: { message: "override rechazado" } },
          salon_plan_alerts: { data: null, error: { message: "alerta rechazada" } },
        },
      })
    );

    await expect(
      assignSalonPlan({
        salonId: SALON_ID,
        planId: "plan-1",
        status: "active",
        startsAt: null,
        endsAt: null,
        trialEndsAt: null,
        notes: "",
      })
    ).rejects.toBeInstanceOf(Error);
    await expect(
      recordSalonPlanPayment({
        salonId: SALON_ID,
        planId: null,
        amount: 1,
        currency: "USD",
        paidAt: "2026-10-09",
        periodStart: "2026-10-09",
        periodEnd: "2026-11-09",
        notes: "",
      })
    ).rejects.toBeInstanceOf(Error);
    await expect(
      updateSalonPlanOverrideStatus("ov-1", "canceled")
    ).rejects.toBeInstanceOf(Error);
    await expect(
      recordPlanAlert({
        salonId: SALON_ID,
        planId: null,
        metricKey: null,
        moduleKey: null,
        severity: "info",
        message: "x",
      })
    ).rejects.toBeInstanceOf(Error);
  });
});
