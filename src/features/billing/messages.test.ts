import { describe, expect, it } from "vitest";
import { calculateLimitState, checkLimitAction, type CommercialLimitMetric } from "./domain/commercial-plan";
import { planLimitMessage } from "./messages";

const metric: CommercialLimitMetric = {
  key: "customers.active",
  moduleKey: "customers",
  name: "Clientes activos",
  description: "Clientes activos",
  unit: "clientes",
  counterKey: "customers_active",
  defaultCountScope: "current",
  isActive: true,
  isArchived: false,
  sortOrder: 1,
};

describe("planLimitMessage", () => {
  const input = { metricName: "Citas", used: 85, maxValue: 100 };

  it("devuelve cadena vacía sin código o sin máximo", () => {
    expect(planLimitMessage(null, input)).toBe("");
    expect(planLimitMessage("near_limit", { ...input, maxValue: null })).toBe("");
  });

  it("traduce cada código al texto visible del aviso", () => {
    expect(planLimitMessage("near_limit", input)).toBe("Citas: vas 85 de 100 en tu plan.");
    expect(planLimitMessage("exceeded", { ...input, used: 120 })).toBe(
      "Citas: superaste el límite de tu plan (120 de 100)."
    );
    expect(planLimitMessage("reached", { ...input, used: 100 })).toBe(
      "Citas: alcanzaste el límite de tu plan (100 de 100)."
    );
    expect(planLimitMessage("action_blocked", { ...input, used: 100 })).toBe(
      "Citas alcanzo el límite del plan (100)."
    );
  });

  it("conserva el texto que produce el dominio para cada nivel de aviso", () => {
    const near = calculateLimitState({
      metric,
      maxValue: 10,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "current",
      used: 9,
    });
    expect(planLimitMessage(near.messageCode, { metricName: metric.name, used: 9, maxValue: 10 })).toBe(
      "Clientes activos: vas 9 de 10 en tu plan."
    );

    const over = calculateLimitState({
      metric,
      maxValue: 10,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "current",
      used: 12,
    });
    expect(planLimitMessage(over.messageCode, { metricName: metric.name, used: 12, maxValue: 10 })).toBe(
      "Clientes activos: superaste el límite de tu plan (12 de 10)."
    );
  });

  it("el dominio devuelve el código de bloqueo al rechazar una acción", () => {
    const check = checkLimitAction({
      metricKey: metric.key,
      metricName: metric.name,
      used: 100,
      requested: 1,
      maxValue: 100,
      enforcementMode: "block",
    });
    expect(check.messageCode).toBe("action_blocked");
    expect(planLimitMessage(check.messageCode, { metricName: metric.name, used: 100, maxValue: 100 })).toBe(
      "Clientes activos alcanzo el límite del plan (100)."
    );
  });
});
