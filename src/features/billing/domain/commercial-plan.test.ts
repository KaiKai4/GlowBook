import { describe, expect, it } from "vitest";
import {
  calculateLimitState,
  checkLimitAction,
  isActionableLimitWarning,
  type CommercialLimitMetric,
} from "./commercial-plan";

const metric: CommercialLimitMetric = {
  key: "customers.active",
  moduleKey: "customers",
  name: "Clientes activos",
  description: "",
  unit: "clientes",
  counterKey: "customers_active",
  defaultCountScope: "current",
  isActive: true,
  isArchived: false,
  sortOrder: 1,
};

describe("commercial plan limits", () => {
  it("does not warn below threshold", () => {
    const result = calculateLimitState({
      metric,
      maxValue: 100,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "current",
      used: 20,
    });

    expect(result.warningLevel).toBe("none");
    expect(result.remaining).toBe(80);
  });

  it("warns near the threshold", () => {
    const result = calculateLimitState({
      metric,
      maxValue: 100,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "current",
      used: 85,
    });

    expect(result.warningLevel).toBe("near_limit");
    expect(result.percentage).toBe(85);
  });

  it("does not mark a zero limit with zero usage as exceeded", () => {
    const result = calculateLimitState({
      metric,
      maxValue: 0,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "current",
      used: 0,
    });

    expect(result.warningLevel).toBe("none");
    expect(result.messageCode).toBeNull();
  });

  it("marks usage above a zero limit as exceeded", () => {
    const result = calculateLimitState({
      metric,
      maxValue: 0,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "current",
      used: 1,
    });

    expect(result.warningLevel).toBe("over_limit");
  });

  it("blocks when configured as block and next action exceeds max", () => {
    const result = checkLimitAction({
      metricKey: metric.key,
      metricName: metric.name,
      used: 100,
      requested: 1,
      maxValue: 100,
      enforcementMode: "block",
    });

    expect(result.allowed).toBe(false);
    expect(result.mode).toBe("block");
  });

  it("allows exceeded usage when configured as warn", () => {
    const result = checkLimitAction({
      metricKey: metric.key,
      metricName: metric.name,
      used: 100,
      requested: 1,
      maxValue: 100,
      enforcementMode: "warn",
    });

    expect(result.allowed).toBe(true);
  });
});

describe("isActionableLimitWarning", () => {
  it("does not surface capacities sitting exactly at the limit", () => {
    const limit = calculateLimitState({
      metric,
      maxValue: 1,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "current",
      used: 1,
    });

    expect(limit.warningLevel).toBe("over_limit");
    expect(isActionableLimitWarning(limit)).toBe(false);
  });

  it("does not surface capacities near the limit", () => {
    const limit = calculateLimitState({
      metric,
      maxValue: 100,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "current",
      used: 85,
    });

    expect(limit.warningLevel).toBe("near_limit");
    expect(isActionableLimitWarning(limit)).toBe(false);
  });

  it("surfaces capacities that exceeded the limit", () => {
    const limit = calculateLimitState({
      metric,
      maxValue: 1,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "current",
      used: 5,
    });

    expect(isActionableLimitWarning(limit)).toBe(true);
  });

  it("surfaces renewable consumption near the limit", () => {
    const limit = calculateLimitState({
      metric: { ...metric, key: "appointments.cycle", name: "Citas", defaultCountScope: "billing_cycle" },
      maxValue: 100,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "billing_cycle",
      used: 85,
    });

    expect(isActionableLimitWarning(limit)).toBe(true);
  });

  it("surfaces renewable consumption at the limit", () => {
    const limit = calculateLimitState({
      metric: { ...metric, key: "appointments.cycle", name: "Citas", defaultCountScope: "billing_cycle" },
      maxValue: 100,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "billing_cycle",
      used: 100,
    });

    expect(isActionableLimitWarning(limit)).toBe(true);
  });
});
