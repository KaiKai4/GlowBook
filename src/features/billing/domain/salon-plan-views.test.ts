import { describe, expect, it } from "vitest";

import { override, plan } from "@/test/billing-plan-fixtures";
import type { CommercialLimitMetric } from "./commercial-plan";
import {
  buildEffectiveLimits,
  extraDetail,
  isPlanAssignmentActive,
  manualExtraName,
  resolveEnabledModules,
  round2,
} from "./salon-plan-views";

const appointmentsMetric: CommercialLimitMetric = {
  key: "appointments_monthly",
  moduleKey: "appointments",
  name: "Citas",
  description: "",
  unit: "citas",
  counterKey: "appointments_total",
  defaultCountScope: "monthly",
  isActive: true,
  isArchived: false,
  sortOrder: 1,
};

const reportsMetric: CommercialLimitMetric = {
  ...appointmentsMetric,
  key: "reports_monthly",
  moduleKey: "reports",
  name: "Reportes",
  unit: "",
};

describe("isPlanAssignmentActive", () => {
  it("considera vigentes solo trialing, active y past_due", () => {
    expect(isPlanAssignmentActive("trialing")).toBe(true);
    expect(isPlanAssignmentActive("active")).toBe(true);
    expect(isPlanAssignmentActive("past_due")).toBe(true);
    expect(isPlanAssignmentActive("paused")).toBe(false);
    expect(isPlanAssignmentActive("canceled")).toBe(false);
    expect(isPlanAssignmentActive(null)).toBe(false);
    expect(isPlanAssignmentActive(undefined)).toBe(false);
  });
});

describe("resolveEnabledModules", () => {
  it("parte de los módulos habilitados del plan", () => {
    expect([...resolveEnabledModules(plan(), [])].sort()).toEqual(["appointments", "employees"]);
  });

  it("sin plan no habilita ningún módulo", () => {
    expect(resolveEnabledModules(null, []).size).toBe(0);
  });

  it("un override puede activar o desactivar un módulo", () => {
    const enabled = resolveEnabledModules(plan(), [
      override({ moduleKey: "reports", moduleEnabled: true }),
      override({ moduleKey: "employees", moduleEnabled: false }),
    ]);
    expect([...enabled].sort()).toEqual(["appointments", "reports"]);
  });

  it("ignora overrides sin módulo o sin valor de activación", () => {
    const enabled = resolveEnabledModules(plan(), [
      override({ moduleKey: null, moduleEnabled: false }),
      override({ moduleKey: "employees", moduleEnabled: null }),
    ]);
    expect([...enabled].sort()).toEqual(["appointments", "employees"]);
  });
});

describe("buildEffectiveLimits", () => {
  it("sin plan no hay límites", () => {
    expect(buildEffectiveLimits(null, [appointmentsMetric], [], {}, new Set())).toEqual([]);
  });

  it("solo calcula límites de módulos habilitados y usa el consumo real", () => {
    const limits = buildEffectiveLimits(
      plan(),
      [appointmentsMetric, reportsMetric],
      [],
      { appointments_monthly: 4 },
      new Set(["appointments"])
    );
    expect(limits.map((limit) => limit.metric.key)).toEqual(["appointments_monthly"]);
    expect(limits[0]?.used).toBe(4);
    expect(limits[0]?.maxValue).toBe(10);
  });

  it("aplica un override de tope sobre el límite del plan", () => {
    const limits = buildEffectiveLimits(
      plan(),
      [appointmentsMetric],
      [override({ metricKey: "appointments_monthly", maxDelta: 5, quantity: 1 })],
      {},
      new Set(["appointments"])
    );
    expect(limits[0]?.maxValue).toBe(15);
  });
});

describe("manualExtraName", () => {
  const moduleByKey = new Map([["reports", "Reportes avanzados"]]);
  const metricByKey = new Map([[appointmentsMetric.key, appointmentsMetric]]);

  it("usa el nombre del módulo cuando el extra es de módulo", () => {
    expect(manualExtraName(override({ moduleKey: "reports" }), moduleByKey, metricByKey)).toBe("Reportes avanzados");
  });

  it("cae a la clave del módulo cuando no hay nombre en catálogo", () => {
    expect(manualExtraName(override({ moduleKey: "employees" }), moduleByKey, metricByKey)).toBe("employees");
  });

  it("usa el nombre de la métrica cuando el extra es de límite", () => {
    expect(
      manualExtraName(override({ moduleKey: null, metricKey: "appointments_monthly" }), moduleByKey, metricByKey)
    ).toBe("Citas");
    expect(
      manualExtraName(override({ moduleKey: null, metricKey: "desconocida" }), moduleByKey, metricByKey)
    ).toBe("desconocida");
  });

  it("sin módulo ni métrica es un extra personalizado", () => {
    expect(manualExtraName(override({ moduleKey: null, metricKey: null }), moduleByKey, metricByKey)).toBe(
      "Extra personalizado"
    );
  });
});

describe("extraDetail", () => {
  const metricByKey = new Map([[appointmentsMetric.key, appointmentsMetric]]);

  it("describe la activación de un módulo", () => {
    expect(extraDetail(override({ moduleKey: "reports", moduleEnabled: true }), null, metricByKey)).toBe("Módulo activado");
    expect(extraDetail(override({ moduleKey: "reports", moduleEnabled: false }), null, metricByKey)).toBe("Módulo desactivado");
  });

  it("muestra el límite fijado con su unidad", () => {
    expect(
      extraDetail(override({ moduleKey: null, metricKey: "appointments_monthly", maxOverride: 50 }), null, metricByKey)
    ).toBe("Límite fijado en 50 citas");
  });

  it("muestra el incremento multiplicado por la cantidad", () => {
    expect(
      extraDetail(override({ moduleKey: null, metricKey: "appointments_monthly", maxDelta: 100, quantity: 3 }), null, metricByKey)
    ).toBe("+300 citas");
  });

  it("usa el delta del addon cuando el override no lo trae", () => {
    const addon = {
      id: "a",
      code: "c",
      name: "n",
      description: "",
      kind: "limit_boost" as const,
      moduleKey: null,
      metricKey: "appointments_monthly",
      limitDelta: 1000,
      currency: "USD",
      monthlyPrice: 8,
      status: "active" as const,
      sortOrder: 0,
    };
    expect(
      extraDetail(override({ moduleKey: null, metricKey: "appointments_monthly", maxDelta: null, quantity: 2 }), addon, metricByKey)
    ).toBe("+2000 citas");
  });

  it("sin datos de tope ni delta es un ajuste genérico", () => {
    expect(extraDetail(override({ moduleKey: null, metricKey: null, maxDelta: null }), null, metricByKey)).toBe(
      "Ajuste de límite"
    );
  });
});

describe("round2", () => {
  it("redondea a dos decimales", () => {
    expect(round2(10.126)).toBe(10.13);
    expect(round2(10)).toBe(10);
  });
});
