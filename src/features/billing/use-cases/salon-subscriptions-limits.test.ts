import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkPlanLimit,
  checkPlanModuleAccess,
  isEffectiveSalonModuleEnabled,
} from "./salon-subscriptions";
import {
  findEffectivePlanRows,
  hasOpenPlanAlert,
  recordPlanAlert,
} from "../data/salon-subscriptions.repo";

import { legacyProfile, override, plan, rows } from "@/test/billing-plan-fixtures";

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

vi.mock("@/features/platform/use-cases/platform-audit", () => ({
  recordPlatformAction: vi.fn(),
}));

const findRowsMock = vi.mocked(findEffectivePlanRows);
const hasOpenAlertMock = vi.mocked(hasOpenPlanAlert);
const recordAlertMock = vi.mocked(recordPlanAlert);

beforeEach(() => {
  vi.clearAllMocks();
  hasOpenAlertMock.mockResolvedValue(false);
  recordAlertMock.mockResolvedValue(undefined);
});

describe("checkPlanLimit", () => {
  it("allows metrics that the plan does not limit", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ plan: plan({ limits: [] }) }));

    const result = await checkPlanLimit({ salonId: "salon-1", metricKey: "appointments_monthly" });

    expect(result.ok).toBe(true);
    expect(recordAlertMock).not.toHaveBeenCalled();
  });

  it("blocks a block-mode limit when the next action would exceed the max and records a danger alert", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ usage: { appointments_monthly: 10 } }));

    const result = await checkPlanLimit({
      salonId: "salon-1",
      metricKey: "appointments_monthly",
    });

    expect(result).toEqual({
      ok: false,
      error: "Citas alcanzo el límite del plan (10).",
    });
    expect(recordAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: "salon-1",
        planId: "plan-basic",
        metricKey: "appointments_monthly",
        moduleKey: "appointments",
        severity: "danger",
      })
    );
  });

  it("uses requestedAmount when deciding whether a block-mode limit is exceeded", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ usage: { appointments_monthly: 8 } }));

    const twoMore = await checkPlanLimit({
      salonId: "salon-1",
      metricKey: "appointments_monthly",
      requestedAmount: 2,
    });

    expect(twoMore.ok).toBe(true);
  });

  it("does not block a block-mode limit that lands exactly on the max", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ usage: { appointments_monthly: 9 } }));

    const result = await checkPlanLimit({ salonId: "salon-1", metricKey: "appointments_monthly" });

    expect(result.ok).toBe(true);
  });

  it("allows over-limit usage in warn mode and records a danger alert when already over", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ usage: { employees_active: 3 } }));

    const result = await checkPlanLimit({ salonId: "salon-1", metricKey: "employees_active" });

    expect(result.ok).toBe(true);
    expect(recordAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({ metricKey: "employees_active", severity: "danger" })
    );
  });

  it("records a warning alert when a warn-mode limit is near the threshold", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ usage: { employees_active: 1 } }));

    const result = await checkPlanLimit({ salonId: "salon-1", metricKey: "employees_active" });

    expect(result.ok).toBe(true);
    expect(recordAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({ metricKey: "employees_active", severity: "warning" })
    );
  });

  it("does not record an alert when usage is comfortably below the threshold", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ usage: { appointments_monthly: 1 } }));

    await checkPlanLimit({ salonId: "salon-1", metricKey: "appointments_monthly" });

    expect(recordAlertMock).not.toHaveBeenCalled();
  });

  it("does not duplicate an alert that is already open for the same salon and metric", async () => {
    hasOpenAlertMock.mockResolvedValueOnce(true);
    findRowsMock.mockResolvedValueOnce(rows({ usage: { appointments_monthly: 10 } }));

    const result = await checkPlanLimit({ salonId: "salon-1", metricKey: "appointments_monthly" });

    expect(result.ok).toBe(false);
    expect(hasOpenAlertMock).toHaveBeenCalledWith("salon-1", "appointments_monthly");
    expect(recordAlertMock).not.toHaveBeenCalled();
  });

  it("never enforces a limit configured with enforcement 'none'", async () => {
    findRowsMock.mockResolvedValueOnce(
      rows({
        overrides: [override({ metricKey: "appointments_monthly", enforcementMode: "none" })],
        usage: { appointments_monthly: 500 },
      })
    );

    const result = await checkPlanLimit({ salonId: "salon-1", metricKey: "appointments_monthly" });

    expect(result.ok).toBe(true);
  });

  it("allows the action when the salon has no plan, so no limit resolves", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ plan: null, usage: {} }));

    const result = await checkPlanLimit({ salonId: "salon-1", metricKey: "appointments_monthly" });

    expect(result.ok).toBe(true);
    expect(recordAlertMock).not.toHaveBeenCalled();
  });
});

describe("checkPlanModuleAccess", () => {
  it("is permissive when the salon has no effective plan (legacy flags decide elsewhere)", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ plan: null, status: null }));

    const result = await checkPlanModuleAccess({ salonId: "salon-1", moduleKey: "reports" });

    expect(result.ok).toBe(true);
  });

  it("allows modules included in the plan", async () => {
    findRowsMock.mockResolvedValueOnce(rows({}));

    const result = await checkPlanModuleAccess({ salonId: "salon-1", moduleKey: "appointments" });

    expect(result.ok).toBe(true);
  });

  it("rejects modules missing from the plan with the module label", async () => {
    findRowsMock.mockResolvedValueOnce(rows({}));

    const result = await checkPlanModuleAccess({ salonId: "salon-1", moduleKey: "reports" });

    expect(result).toEqual({
      ok: false,
      error: "Reportes no esta incluido en el plan de este salon.",
    });
  });

  it("rejects a catalog module that the plan does not include, even with an empty plan", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ plan: plan({ modules: [] }) }));

    const result = await checkPlanModuleAccess({ salonId: "salon-1", moduleKey: "plantillas" });

    expect(result.ok).toBe(false);
  });
});

describe("isEffectiveSalonModuleEnabled", () => {
  it("uses the effective plan modules when a plan exists", async () => {
    findRowsMock.mockResolvedValueOnce(rows({}));

    await expect(
      isEffectiveSalonModuleEnabled(legacyProfile(["appointments"]), "appointments")
    ).resolves.toBe(true);
  });

  it("returns false for plan modules that are not enabled, ignoring legacy flags", async () => {
    findRowsMock.mockResolvedValueOnce(rows({}));

    await expect(isEffectiveSalonModuleEnabled(legacyProfile(null), "reports")).resolves.toBe(false);
  });

  it("falls back to the legacy disabled_features list when there is no plan", async () => {
    findRowsMock.mockResolvedValueOnce(rows({ plan: null, status: null }));

    await expect(isEffectiveSalonModuleEnabled(legacyProfile(["reports"]), "reports")).resolves.toBe(
      false
    );
    findRowsMock.mockResolvedValueOnce(rows({ plan: null, status: null }));
    await expect(isEffectiveSalonModuleEnabled(legacyProfile(["reports"]), "expenses")).resolves.toBe(
      true
    );
  });

  it("falls back to legacy flags when reading the effective plan fails", async () => {
    findRowsMock.mockRejectedValueOnce(new Error("db caida"));

    await expect(isEffectiveSalonModuleEnabled(legacyProfile(["expenses"]), "expenses")).resolves.toBe(
      false
    );
  });
});
