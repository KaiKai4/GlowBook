import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveCommercialPlan,
  deleteCommercialPlan,
  saveCommercialPlan,
} from "../data/commercial-plans.repo";
import { recordPlatformAction } from "@/features/platform/use-cases/platform-audit";
import type { CommercialPlan } from "../domain/commercial-plan";
import {
  removeCommercialPlanConfig,
  saveCommercialPlanConfig,
} from "./commercial-plans";

vi.mock("../data/commercial-plans.repo", () => ({
  archiveCommercialPlan: vi.fn(),
  deleteCommercialPlan: vi.fn(),
  findPlanCatalog: vi.fn(),
  saveCommercialPlan: vi.fn(),
  saveLimitMetric: vi.fn(),
  savePlanLimit: vi.fn(),
  savePlanModule: vi.fn(),
}));

vi.mock("../data/commercial-addons.repo", () => ({
  findCommercialAddons: vi.fn(),
}));

vi.mock("../data/salon-subscriptions.repo", () => ({
  findSubscriptionRows: vi.fn(),
}));

vi.mock("@/features/platform/use-cases/platform-audit", () => ({
  recordPlatformAction: vi.fn(),
}));

const saveCommercialPlanMock = vi.mocked(saveCommercialPlan);
const archiveMock = vi.mocked(archiveCommercialPlan);
const deleteMock = vi.mocked(deleteCommercialPlan);
const auditMock = vi.mocked(recordPlatformAction);

const PLAN_ID = "11111111-1111-4111-8111-111111111111";

const planFixture: CommercialPlan = {
  id: PLAN_ID,
  code: "pro",
  name: "Pro",
  description: "",
  currency: "USD",
  monthlyPrice: 10,
  trialDays: 0,
  status: "draft",
  isPublic: false,
  sortOrder: 0,
  modules: [],
  limits: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  saveCommercialPlanMock.mockResolvedValue("plan-id-1");
  auditMock.mockResolvedValue(undefined);
});

describe("saveCommercialPlanConfig", () => {
  it("rejects a plan name shorter than two characters before touching the repo", async () => {
    const result = await saveCommercialPlanConfig({ name: "A", monthlyPrice: 5 });

    expect(result).toEqual({ ok: false, error: "Escribe el nombre del plan." });
    expect(saveCommercialPlanMock).not.toHaveBeenCalled();
  });

  it("rejects negative prices with the price message", async () => {
    const result = await saveCommercialPlanConfig({ name: "Pro", monthlyPrice: -1 });

    expect(result).toEqual({ ok: false, error: "El precio no puede ser negativo." });
    expect(saveCommercialPlanMock).not.toHaveBeenCalled();
  });

  it("rejects negative trial days", async () => {
    const result = await saveCommercialPlanConfig({ name: "Pro", monthlyPrice: 5, trialDays: -2 });

    expect(result).toEqual({ ok: false, error: "El trial no puede ser negativo." });
  });

  it("derives the code from the name when none is given, coerces price and uppercases currency", async () => {
    const result = await saveCommercialPlanConfig({
      name: "Plan Básico Ñandú",
      monthlyPrice: "25",
      currency: "usd",
    });

    expect(result).toEqual({ ok: true, value: "plan-id-1" });
    expect(saveCommercialPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "plan-basico-nandu",
        monthlyPrice: 25,
        currency: "USD",
        status: "draft",
        isPublic: false,
        trialDays: 0,
      })
    );
  });

  it("normalizes an explicit code instead of deriving it from the name", async () => {
    await saveCommercialPlanConfig({ name: "Pro", code: "  Plan PRO #2 ", monthlyPrice: 1 });

    expect(saveCommercialPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: "plan-pro-2" })
    );
  });

  it("rejects currencies that are not exactly three characters", async () => {
    const result = await saveCommercialPlanConfig({ name: "Pro", monthlyPrice: 1, currency: "US" });

    expect(result.ok).toBe(false);
    expect(saveCommercialPlanMock).not.toHaveBeenCalled();
  });

  it("audits the save with the actor and returns the saved id", async () => {
    await saveCommercialPlanConfig({ name: "Pro", monthlyPrice: 1 }, "actor-7");

    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "actor-7",
        action: "commercial_plan_saved",
      })
    );
  });

  it("stores a null actor when none is provided", async () => {
    await saveCommercialPlanConfig({ name: "Pro", monthlyPrice: 1 });

    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: null }));
  });

  it("maps repo errors to the bare prefix, without the raw cause", async () => {
    saveCommercialPlanMock.mockRejectedValueOnce(new Error("codigo duplicado"));

    const result = await saveCommercialPlanConfig({ name: "Pro", monthlyPrice: 1 });

    expect(result).toEqual({ ok: false, error: "No se pudo guardar el plan." });
  });

  it("maps non-Error failures to the bare prefix", async () => {
    saveCommercialPlanMock.mockRejectedValueOnce("fallo raro");

    const result = await saveCommercialPlanConfig({ name: "Pro", monthlyPrice: 1 });

    expect(result).toEqual({ ok: false, error: "No se pudo guardar el plan." });
  });
});

describe("removeCommercialPlanConfig", () => {
  it("archives a plan that still has assignments and audits it as archived", async () => {
    const result = await removeCommercialPlanConfig(planFixture, true, "actor-1");

    expect(result.ok).toBe(true);
    expect(archiveMock).toHaveBeenCalledWith(PLAN_ID);
    expect(deleteMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "commercial_plan_archived" })
    );
  });

  it("hard-deletes a plan without assignments and audits it as deleted", async () => {
    const result = await removeCommercialPlanConfig(planFixture, false, "actor-1");

    expect(result.ok).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith(PLAN_ID);
    expect(archiveMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "commercial_plan_deleted" })
    );
  });

  it("reports failures with the removal prefix", async () => {
    deleteMock.mockRejectedValueOnce(new Error("fk"));

    const result = await removeCommercialPlanConfig(planFixture, false);

    expect(result).toEqual({ ok: false, error: "No se pudo eliminar el plan." });
  });
});
