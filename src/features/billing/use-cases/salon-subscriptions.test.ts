import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEffectiveSalonPlan } from "./salon-subscriptions";
import {
  findEffectivePlanRows,
  hasOpenPlanAlert,
  recordPlanAlert,
} from "../data/salon-subscriptions.repo";

import { override, plan, rows } from "@/test/billing-plan-fixtures";
vi.mock("../data/salon-subscriptions.repo", () => ({
  activatePaidPeriod: vi.fn(),
  assignSalonPlan: vi.fn(),
  findAssignmentForPayment: vi.fn(),
  findAssignmentStartsAt: vi.fn(),
  findEffectivePlanRows: vi.fn(),
  findOpenSalonAlerts: vi.fn(),
  findSalonPayments: vi.fn(),
  findSubscriptionRows: vi.fn(),
  hasOpenPlanAlert: vi.fn(),
  recordPlanAlert: vi.fn(),
  recordSalonPlanPayment: vi.fn(),
  resolvePlanAlert: vi.fn(),
  saveSalonPlanOverride: vi.fn(),
  updateSalonPlanOverrideStatus: vi.fn(),
}));

vi.mock("../data/commercial-addons.repo", () => ({
  findCommercialAddonById: vi.fn(),
  findCommercialAddons: vi.fn(),
}));

vi.mock("../data/commercial-plans.repo", () => ({
  findPlanCatalog: vi.fn(),
  findPlanWithChildren: vi.fn(),
}));

vi.mock("@/features/audit", () => ({
  publishAuditEvent: vi.fn(async () => []),
}));

const findRowsMock = vi.mocked(findEffectivePlanRows);
const hasOpenAlertMock = vi.mocked(hasOpenPlanAlert);
const recordAlertMock = vi.mocked(recordPlanAlert);

beforeEach(() => {
  vi.clearAllMocks();
  hasOpenAlertMock.mockResolvedValue(false);
  recordAlertMock.mockResolvedValue(undefined);
});

describe("getEffectiveSalonPlan", () => {
  it("uses the plan while the assignment is trialing, active or past_due", async () => {
    for (const status of ["trialing", "active", "past_due"] as const) {
      findRowsMock.mockResolvedValueOnce(rows({ status }));

      const result = await getEffectiveSalonPlan("salon-1");

      expect(result.plan?.id).toBe("plan-basic");
      expect(result.assignmentStatus).toBe(status);
    }
  });

  it("drops the plan for paused or canceled assignments", async () => {
    for (const status of ["paused", "canceled"] as const) {
      findRowsMock.mockResolvedValueOnce(rows({ status }));

      const result = await getEffectiveSalonPlan("salon-1");

      expect(result.plan).toBeNull();
      expect(result.enabledModules).toEqual([]);
      expect(result.limits).toEqual([]);
      expect(result.assignmentStatus).toBe(status);
    }
  });

  it("returns no plan and no assignment status when the salon has no assignment", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ status: null, plan: null }));

    const result = await getEffectiveSalonPlan("salon-1");

    expect(result.plan).toBeNull();
    expect(result.assignmentStatus).toBeNull();
    expect(result.enabledModules).toEqual([]);
  });

  it("enables only plan modules flagged as enabled and lists the rest as disabled", async () => {
    findRowsMock.mockResolvedValueOnce(rows({}));

    const result = await getEffectiveSalonPlan("salon-1");

    expect(result.enabledModules.sort()).toEqual(["appointments", "employees"]);
    expect(result.disabledModules).toContain("reports");
    expect(result.disabledModules).toContain("retail");
    expect(result.disabledModules).not.toContain("appointments");
  });

  it("module overrides can grant a module the plan does not include", async () => {
    findRowsMock.mockResolvedValueOnce(
      rows({ overrides: [override({ moduleKey: "reports", moduleEnabled: true })] })
    );

    const result = await getEffectiveSalonPlan("salon-1");

    expect(result.enabledModules).toContain("reports");
    expect(result.disabledModules).not.toContain("reports");
  });

  it("module overrides can revoke a module the plan includes", async () => {
    findRowsMock.mockResolvedValueOnce(
      rows({ overrides: [override({ moduleKey: "employees", moduleEnabled: false })] })
    );

    const result = await getEffectiveSalonPlan("salon-1");

    expect(result.enabledModules).not.toContain("employees");
    expect(result.disabledModules).toContain("employees");
  });

  it("ignores module overrides with a null moduleEnabled flag", async () => {
    findRowsMock.mockResolvedValueOnce(
      rows({ overrides: [override({ moduleKey: "employees", moduleEnabled: null })] })
    );

    const result = await getEffectiveSalonPlan("salon-1");

    expect(result.enabledModules).toContain("employees");
  });

  it("builds limits only for metrics whose module is enabled", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ usage: { appointments_monthly: 3 } }));

    const result = await getEffectiveSalonPlan("salon-1");
    const keys = result.limits.map((limit) => limit.metric.key);

    expect(keys).toEqual(["appointments_monthly", "employees_active"]);
  });

  it("computes remaining, percentage and warning level from usage", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ usage: { appointments_monthly: 9 } }));

    const limit = (await getEffectiveSalonPlan("salon-1")).limits.find(
      (item) => item.metric.key === "appointments_monthly"
    );

    expect(limit).toMatchObject({
      maxValue: 10,
      used: 9,
      remaining: 1,
      percentage: 90,
      warningLevel: "near_limit",
      enforcementMode: "block",
    });
  });

  it("treats missing usage as zero", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ usage: {} }));

    const limit = (await getEffectiveSalonPlan("salon-1")).limits.find(
      (item) => item.metric.key === "employees_active"
    );

    expect(limit?.used).toBe(0);
    expect(limit?.warningLevel).toBe("none");
  });

  it("applies a limit delta override scaled by quantity on top of the plan max", async () => {
    findRowsMock.mockResolvedValueOnce(
      rows({
        overrides: [override({ metricKey: "appointments_monthly", maxDelta: 5, quantity: 2 })],
      })
    );

    const limit = (await getEffectiveSalonPlan("salon-1")).limits.find(
      (item) => item.metric.key === "appointments_monthly"
    );

    expect(limit?.maxValue).toBe(20);
  });

  it("a fixed max override wins over the plan max and the deltas", async () => {
    findRowsMock.mockResolvedValueOnce(
      rows({
        overrides: [
          override({ metricKey: "appointments_monthly", maxDelta: 5 }),
          override({ id: "ov-2", metricKey: "appointments_monthly", maxOverride: 50 }),
        ],
      })
    );

    const limit = (await getEffectiveSalonPlan("salon-1")).limits.find(
      (item) => item.metric.key === "appointments_monthly"
    );

    expect(limit?.maxValue).toBe(50);
  });

  it("keeps unlimited plan limits unlimited when only deltas apply", async () => {
    const unlimited = plan({
      limits: [
        {
          metricKey: "appointments_monthly",
          maxValue: null,
          enforcementMode: "block",
          warningThreshold: 80,
          countScope: "monthly",
        },
      ],
    });
    findRowsMock.mockResolvedValueOnce(
      rows({
        plan: unlimited,
        overrides: [override({ metricKey: "appointments_monthly", maxDelta: 5 })],
      })
    );

    const limit = (await getEffectiveSalonPlan("salon-1")).limits.find(
      (item) => item.metric.key === "appointments_monthly"
    );

    expect(limit?.maxValue).toBeNull();
    expect(limit?.remaining).toBeNull();
  });

  it("defaults to warn mode and an 80% threshold when the plan has no limit row", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ plan: plan({ limits: [] }), usage: {} }));

    const limit = (await getEffectiveSalonPlan("salon-1")).limits.find(
      (item) => item.metric.key === "appointments_monthly"
    );

    expect(limit).toMatchObject({
      maxValue: null,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "monthly",
    });
  });

  it("a mode override replaces the plan enforcement mode", async () => {
    findRowsMock.mockResolvedValueOnce(
      rows({
        overrides: [override({ metricKey: "appointments_monthly", enforcementMode: "warn" })],
      })
    );

    const limit = (await getEffectiveSalonPlan("salon-1")).limits.find(
      (item) => item.metric.key === "appointments_monthly"
    );

    expect(limit?.enforcementMode).toBe("warn");
  });

  it("exposes the raw usage map alongside the computed limits", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ usage: { appointments_monthly: 4, other: 1 } }));

    const result = await getEffectiveSalonPlan("salon-1");

    expect(result.usage).toEqual({ appointments_monthly: 4, other: 1 });
  });
});

