import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  argsOf,
  createBillingSupabaseFake,
  queriesOn,
  type BillingSupabaseFake,
  firstQueryOn,
} from "@/test/billing-feature-supabase";
import {
  archiveCommercialPlan,
  deleteCommercialPlan,
  findActiveMetrics,
  findPlanCatalog,
  findPlanWithChildren,
  savePlanLimit,
  savePlanModule,
  saveCommercialPlan,
} from "./commercial-plans.repo";

// Catálogo comercial (planes, módulos y límites). Es configuración global
// cross-tenant: no lleva salon_id, pero sus tablas hijas se filtran por plan_id.

const admin = vi.hoisted(() => ({ factory: vi.fn() }));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: admin.factory,
}));

function useFake(fake: BillingSupabaseFake) {
  admin.factory.mockReturnValue(fake);
}

const metricRow = (key: string, overrides: Record<string, unknown> = {}) => ({
  key,
  module_key: "appointments",
  name: "Citas",
  description: "Citas del mes",
  unit: "citas",
  counter_key: "appointments_total",
  default_count_scope: "monthly",
  is_active: true,
  is_archived: false,
  sort_order: 1,
  ...overrides,
});

const planRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  code: "basico",
  name: "Básico",
  description: "",
  currency: "USD",
  monthly_price: "19.90",
  trial_days: 14,
  status: "active",
  is_public: true,
  sort_order: 1,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findPlanCatalog", () => {
  it("consulta cada tabla del catálogo con sus columnas y orden", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await findPlanCatalog();

    const expectations: Array<[string, string]> = [
      ["platform_modules", "sort_order"],
      ["commercial_limit_metrics", "sort_order"],
      ["commercial_plans", "sort_order"],
      ["commercial_plan_modules", "module_key"],
      ["commercial_plan_limits", "metric_key"],
    ];
    for (const [table, orderColumn] of expectations) {
      const query = firstQueryOn(fake, table);
      expect(query, table).toBeDefined();
      expect(argsOf(query, "order")).toEqual([orderColumn, { ascending: true }]);
    }
    expect(argsOf(firstQueryOn(fake, "commercial_plans"), "select")?.[0]).toEqual(
      expect.stringContaining("monthly_price")
    );
  });

  it("mapea módulos, métricas y planes con sus módulos y límites del mismo plan", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        platform_modules: {
          data: [
            {
              key: "appointments",
              name: "Citas",
              description: "Agenda",
              nav_href: "/appointments",
              icon_name: "calendar",
              sort_order: 1,
              is_active: true,
              is_archived: false,
            },
          ],
          error: null,
        },
        commercial_limit_metrics: { data: [metricRow("appointments_monthly")], error: null },
        commercial_plans: {
          data: [planRow("plan-basico"), planRow("plan-pro", { code: "pro", name: "Pro", monthly_price: 49 })],
          error: null,
        },
        commercial_plan_modules: {
          data: [
            { plan_id: "plan-basico", module_key: "appointments", enabled: true },
            { plan_id: "plan-pro", module_key: "reports", enabled: true },
          ],
          error: null,
        },
        commercial_plan_limits: {
          data: [
            {
              plan_id: "plan-basico",
              metric_key: "appointments_monthly",
              max_value: 100,
              enforcement_mode: "block",
              warning_threshold: 80,
              count_scope: "monthly",
            },
          ],
          error: null,
        },
      },
    });
    useFake(fake);

    const catalog = await findPlanCatalog();

    expect(catalog.modules).toEqual([
      {
        key: "appointments",
        name: "Citas",
        description: "Agenda",
        navHref: "/appointments",
        iconName: "calendar",
        sortOrder: 1,
        isActive: true,
        isArchived: false,
      },
    ]);
    expect(catalog.metrics[0]).toEqual(
      expect.objectContaining({
        key: "appointments_monthly",
        moduleKey: "appointments",
        counterKey: "appointments_total",
        defaultCountScope: "monthly",
      })
    );

    const basico = catalog.plans.find((plan) => plan.id === "plan-basico");
    const pro = catalog.plans.find((plan) => plan.id === "plan-pro");
    expect(basico).toEqual(
      expect.objectContaining({
        monthlyPrice: 19.9,
        trialDays: 14,
        modules: [{ moduleKey: "appointments", enabled: true }],
        limits: [
          {
            metricKey: "appointments_monthly",
            maxValue: 100,
            enforcementMode: "block",
            warningThreshold: 80,
            countScope: "monthly",
          },
        ],
      })
    );
    // El plan sin límites no hereda los del otro plan.
    expect(pro).toEqual(
      expect.objectContaining({
        monthlyPrice: 49,
        modules: [{ moduleKey: "reports", enabled: true }],
        limits: [],
      })
    );
  });

  it("devuelve un catálogo vacío cuando no hay filas", async () => {
    useFake(createBillingSupabaseFake());

    expect(await findPlanCatalog()).toEqual({ modules: [], metrics: [], plans: [] });
  });

  it("propaga el error de cualquiera de las consultas", async () => {
    useFake(
      createBillingSupabaseFake({
        tables: { commercial_plans: { data: null, error: { message: "fallo de catálogo" } } },
      })
    );

    await expect(findPlanCatalog()).rejects.toBeInstanceOf(Error);
  });
});

describe("findActiveMetrics", () => {
  it("descarta métricas inactivas o archivadas", async () => {
    useFake(
      createBillingSupabaseFake({
        tables: {
          commercial_limit_metrics: {
            data: [
              metricRow("activa"),
              metricRow("inactiva", { is_active: false }),
              metricRow("archivada", { is_archived: true }),
            ],
            error: null,
          },
        },
      })
    );

    const metrics = await findActiveMetrics();

    expect(metrics.map((metric) => metric.key)).toEqual(["activa"]);
  });
});

describe("findPlanWithChildren", () => {
  it("devuelve null sin consultar módulos ni límites cuando el plan no existe", async () => {
    const fake = createBillingSupabaseFake({
      tables: { commercial_plans: { data: null, error: null } },
    });
    useFake(fake);

    expect(await findPlanWithChildren("missing")).toBeNull();
    expect(queriesOn(fake, "commercial_plan_modules")).toHaveLength(0);
    expect(queriesOn(fake, "commercial_plan_limits")).toHaveLength(0);
  });

  it("filtra módulos y límites por plan_id y arma el plan completo", async () => {
    const fake = createBillingSupabaseFake({
      tables: {
        commercial_plans: { data: planRow("plan-1", { monthly_price: "5.5" }), error: null },
        commercial_plan_modules: {
          data: [{ plan_id: "plan-1", module_key: "employees", enabled: false }],
          error: null,
        },
        commercial_plan_limits: {
          data: [
            {
              plan_id: "plan-1",
              metric_key: "employees_active",
              max_value: null,
              enforcement_mode: "warn",
              warning_threshold: 50,
              count_scope: "current",
            },
          ],
          error: null,
        },
      },
    });
    useFake(fake);

    const plan = await findPlanWithChildren("plan-1");

    expect(argsOf(firstQueryOn(fake, "commercial_plans"), "eq")).toEqual(["id", "plan-1"]);
    expect(argsOf(firstQueryOn(fake, "commercial_plan_modules"), "eq")).toEqual(["plan_id", "plan-1"]);
    expect(argsOf(firstQueryOn(fake, "commercial_plan_limits"), "eq")).toEqual(["plan_id", "plan-1"]);
    expect(plan).toEqual(
      expect.objectContaining({
        id: "plan-1",
        monthlyPrice: 5.5,
        modules: [{ moduleKey: "employees", enabled: false }],
        limits: [
          {
            metricKey: "employees_active",
            maxValue: null,
            enforcementMode: "warn",
            warningThreshold: 50,
            countScope: "current",
          },
        ],
      })
    );
  });

  it("lanza el error de la consulta principal del plan", async () => {
    useFake(
      createBillingSupabaseFake({
        tables: { commercial_plans: { data: null, error: { message: "sin acceso" } } },
      })
    );

    await expect(findPlanWithChildren("plan-1")).rejects.toBeInstanceOf(Error);
  });
});

describe("saveCommercialPlan", () => {
  const values = {
    code: "pro",
    name: "Pro",
    description: "Para equipos",
    currency: "USD",
    monthlyPrice: 49,
    trialDays: 7,
    status: "active" as const,
    isPublic: true,
    sortOrder: 2,
  };

  it("actualiza el plan existente por id sin insertar uno nuevo", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    const id = await saveCommercialPlan({ ...values, id: "plan-1" });

    expect(id).toBe("plan-1");
    const query = firstQueryOn(fake, "commercial_plans");
    expect(argsOf(query, "insert")).toBeUndefined();
    expect(argsOf(query, "update")?.[0]).toEqual({
      code: "pro",
      name: "Pro",
      description: "Para equipos",
      currency: "USD",
      monthly_price: 49,
      trial_days: 7,
      status: "active",
      is_public: true,
      sort_order: 2,
    });
    expect(argsOf(query, "eq")).toEqual(["id", "plan-1"]);
  });

  it("inserta un plan nuevo y devuelve el id generado", async () => {
    const fake = createBillingSupabaseFake({
      tables: { commercial_plans: { data: { id: "plan-nuevo" }, error: null } },
    });
    useFake(fake);

    expect(await saveCommercialPlan(values)).toBe("plan-nuevo");
    const query = firstQueryOn(fake, "commercial_plans");
    expect(argsOf(query, "insert")?.[0]).toEqual(expect.objectContaining({ code: "pro", monthly_price: 49 }));
    expect(argsOf(query, "select")).toEqual(["id"]);
  });

  it("falla con mensaje propio cuando la inserción no devuelve fila", async () => {
    useFake(createBillingSupabaseFake({ tables: { commercial_plans: { data: null, error: null } } }));

    await expect(saveCommercialPlan(values)).rejects.toThrow("No se pudo crear el plan.");
  });

  it("propaga el error de la inserción", async () => {
    useFake(
      createBillingSupabaseFake({
        tables: { commercial_plans: { data: null, error: { message: "código duplicado" } } },
      })
    );

    await expect(saveCommercialPlan(values)).rejects.toBeInstanceOf(Error);
  });
});

describe("archiveCommercialPlan y deleteCommercialPlan", () => {
  it("archiva el plan cambiando su estado, sin borrarlo", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await archiveCommercialPlan("plan-1");

    const query = firstQueryOn(fake, "commercial_plans");
    expect(argsOf(query, "update")).toEqual([{ status: "archived" }]);
    expect(argsOf(query, "eq")).toEqual(["id", "plan-1"]);
    expect(argsOf(query, "delete")).toBeUndefined();
  });

  it("borra el plan por id", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await deleteCommercialPlan("plan-1");

    const query = firstQueryOn(fake, "commercial_plans");
    expect(query.calls.map((call) => call.method)).toEqual(["delete", "eq"]);
    expect(argsOf(query, "eq")).toEqual(["id", "plan-1"]);
  });

  it("propaga errores de escritura al archivar y al borrar", async () => {
    useFake(
      createBillingSupabaseFake({
        tables: { commercial_plans: { data: null, error: { message: "bloqueado" } } },
      })
    );

    await expect(archiveCommercialPlan("plan-1")).rejects.toBeInstanceOf(Error);
    await expect(deleteCommercialPlan("plan-1")).rejects.toBeInstanceOf(Error);
  });
});

describe("savePlanModule y savePlanLimit", () => {
  it("hace upsert del módulo del plan con conflicto sobre plan_id y module_key", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await savePlanModule({ planId: "plan-1", moduleKey: "reports", enabled: false });

    const query = firstQueryOn(fake, "commercial_plan_modules");
    expect(argsOf(query, "upsert")).toEqual([
      { plan_id: "plan-1", module_key: "reports", enabled: false },
      { onConflict: "plan_id,module_key" },
    ]);
  });

  it("hace upsert del límite del plan con conflicto sobre plan_id y metric_key", async () => {
    const fake = createBillingSupabaseFake();
    useFake(fake);

    await savePlanLimit({
      planId: "plan-1",
      metricKey: "employees_active",
      maxValue: null,
      enforcementMode: "warn",
      warningThreshold: 60,
      countScope: "current",
    });

    const query = firstQueryOn(fake, "commercial_plan_limits");
    expect(argsOf(query, "upsert")).toEqual([
      {
        plan_id: "plan-1",
        metric_key: "employees_active",
        max_value: null,
        enforcement_mode: "warn",
        warning_threshold: 60,
        count_scope: "current",
      },
      { onConflict: "plan_id,metric_key" },
    ]);
  });

  it("propaga el error de escritura de módulos y límites", async () => {
    useFake(
      createBillingSupabaseFake({
        tables: {
          commercial_plan_modules: { data: null, error: { message: "upsert rechazado" } },
          commercial_plan_limits: { data: null, error: { message: "límite rechazado" } },
        },
      })
    );

    await expect(
      savePlanModule({ planId: "plan-1", moduleKey: "reports", enabled: true })
    ).rejects.toBeInstanceOf(Error);
    await expect(
      savePlanLimit({
        planId: "plan-1",
        metricKey: "x",
        maxValue: 1,
        enforcementMode: "block",
        warningThreshold: 80,
        countScope: "monthly",
      })
    ).rejects.toBeInstanceOf(Error);
  });
});
