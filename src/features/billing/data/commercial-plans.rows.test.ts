import { describe, expect, it } from "vitest";
import { mapPlan, type PlanDbRow, type PlanLimitDbRow, type PlanModuleDbRow } from "./commercial-plans.rows";

const PLAN: PlanDbRow = {
  id: "plan-1",
  code: "pro",
  name: "Pro",
  description: "Plan profesional",
  currency: "USD",
  monthly_price: 29.5,
  trial_days: 14,
  status: "active",
  is_public: true,
  sort_order: 2,
};

describe("mapPlan", () => {
  it("convierte el precio a número y solo incluye módulos y límites del plan", () => {
    const modules: PlanModuleDbRow[] = [
      { plan_id: "plan-1", module_key: "expenses", enabled: true },
      { plan_id: "plan-1", module_key: "inventory", enabled: false },
      { plan_id: "plan-2", module_key: "retail", enabled: true },
    ];
    const limits: PlanLimitDbRow[] = [
      {
        plan_id: "plan-1",
        metric_key: "appointments_monthly",
        max_value: 100,
        enforcement_mode: "warn",
        warning_threshold: 80,
        count_scope: "monthly",
      },
      {
        plan_id: "plan-2",
        metric_key: "employees",
        max_value: 5,
        enforcement_mode: "block",
        warning_threshold: 0,
        count_scope: "current",
      },
    ];

    const plan = mapPlan(PLAN, modules, limits);

    expect(plan.monthlyPrice).toBe(29.5);
    expect(plan.status).toBe("active");
    expect(plan.modules).toEqual([
      { moduleKey: "expenses", enabled: true },
      { moduleKey: "inventory", enabled: false },
    ]);
    expect(plan.limits).toEqual([
      {
        metricKey: "appointments_monthly",
        maxValue: 100,
        enforcementMode: "warn",
        warningThreshold: 80,
        countScope: "monthly",
      },
    ]);
  });

  it("conserva los límites sin máximo", () => {
    const limits: PlanLimitDbRow[] = [
      {
        plan_id: "plan-1",
        metric_key: "employees",
        max_value: null,
        enforcement_mode: "none",
        warning_threshold: 0,
        count_scope: "lifetime",
      },
    ];

    const plan = mapPlan(PLAN, [], limits);

    expect(plan.limits).toEqual([
      {
        metricKey: "employees",
        maxValue: null,
        enforcementMode: "none",
        warningThreshold: 0,
        countScope: "lifetime",
      },
    ]);
  });

  it("descarta una clave de módulo retirada del catálogo sin romper el plan", () => {
    const modules: PlanModuleDbRow[] = [
      { plan_id: "plan-1", module_key: "modulo_retirado", enabled: true },
      { plan_id: "plan-1", module_key: "salon", enabled: true },
    ];

    const plan = mapPlan(PLAN, modules, []);

    expect(plan.modules).toEqual([{ moduleKey: "salon", enabled: true }]);
  });
});
