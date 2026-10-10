import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCommercialPlanDeps } from "@/test/billing-command-fakes";
import {
  archivePlan,
  deletePlan,
  saveCommercialPlanConfig,
} from "./commercial-plans";
import { issuePlatformAdminProof } from "@/infra/auth/platform-admin-proof";
const ADMIN_PROOF = issuePlatformAdminProof("admin-1");

// Los comandos de escritura reciben sus dependencias por parámetro: los tests
// inyectan fakes tipados y no hace falta vi.mock de data/.

vi.mock("@/features/audit", () => ({
  publishAuditEvent: vi.fn(async () => []),
}));

const PLAN_ID = "11111111-1111-4111-8111-111111111111";

let deps: ReturnType<typeof fakeCommercialPlanDeps>;

beforeEach(() => {
  deps = fakeCommercialPlanDeps();
});

describe("saveCommercialPlanConfig", () => {
  it("rejects a plan name shorter than two characters before touching the repo", async () => {
    const result = await saveCommercialPlanConfig(ADMIN_PROOF, { name: "A", monthlyPrice: 5 }, undefined, deps);

    expect(result).toEqual({ ok: false, error: "Escribe el nombre del plan." });
    expect(deps.saveCommercialPlan).not.toHaveBeenCalled();
  });

  it("rejects negative prices with the price message", async () => {
    const result = await saveCommercialPlanConfig(ADMIN_PROOF, { name: "Pro", monthlyPrice: -1 }, undefined, deps);

    expect(result).toEqual({ ok: false, error: "El precio no puede ser negativo." });
    expect(deps.saveCommercialPlan).not.toHaveBeenCalled();
  });

  it("rejects negative trial days", async () => {
    const result = await saveCommercialPlanConfig(ADMIN_PROOF, { name: "Pro", monthlyPrice: 5, trialDays: -2 }, undefined, deps);

    expect(result).toEqual({ ok: false, error: "El trial no puede ser negativo." });
  });

  it("derives the code from the name when none is given, coerces price and uppercases currency", async () => {
    const result = await saveCommercialPlanConfig(ADMIN_PROOF, 
      {
        name: "Plan Básico Ñandú",
        monthlyPrice: "25",
        currency: "usd",
      },
      undefined,
      deps
    );

    expect(result).toEqual({ ok: true, value: "plan-id-1" });
    expect(deps.saveCommercialPlan).toHaveBeenCalledWith(ADMIN_PROOF, 
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
    await saveCommercialPlanConfig(ADMIN_PROOF, { name: "Pro", code: "  Plan PRO #2 ", monthlyPrice: 1 }, undefined, deps);

    expect(deps.saveCommercialPlan).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({ code: "plan-pro-2" })
    );
  });

  it("rejects currencies that are not exactly three characters", async () => {
    const result = await saveCommercialPlanConfig(ADMIN_PROOF, { name: "Pro", monthlyPrice: 1, currency: "US" }, undefined, deps);

    expect(result.ok).toBe(false);
    expect(deps.saveCommercialPlan).not.toHaveBeenCalled();
  });

  it("audits the save with the actor and returns the saved id", async () => {
    await saveCommercialPlanConfig(ADMIN_PROOF, { name: "Pro", monthlyPrice: 1 }, "actor-7", deps);

    expect(deps.publishAuditEvent).toHaveBeenCalledWith("billing.plan_saved",
      expect.objectContaining({
        actorUserId: "actor-7",
        action: "commercial_plan_saved",
      })
    );
  });

  it("stores a null actor when none is provided", async () => {
    await saveCommercialPlanConfig(ADMIN_PROOF, { name: "Pro", monthlyPrice: 1 }, undefined, deps);

    expect(deps.publishAuditEvent).toHaveBeenCalledWith("billing.plan_saved", expect.objectContaining({ actorUserId: null }));
  });

  it("maps repo errors to the bare prefix, without the raw cause", async () => {
    deps.saveCommercialPlan.mockRejectedValueOnce(new Error("código duplicado"));

    const result = await saveCommercialPlanConfig(ADMIN_PROOF, { name: "Pro", monthlyPrice: 1 }, undefined, deps);

    expect(result).toEqual({ ok: false, error: "No se pudo guardar el plan." });
  });

  it("maps non-Error failures to the bare prefix", async () => {
    deps.saveCommercialPlan.mockRejectedValueOnce("fallo raro");

    const result = await saveCommercialPlanConfig(ADMIN_PROOF, { name: "Pro", monthlyPrice: 1 }, undefined, deps);

    expect(result).toEqual({ ok: false, error: "No se pudo guardar el plan." });
  });
});

describe("archivePlan", () => {
  it("archives the plan and audits it as archived", async () => {
    const result = await archivePlan(ADMIN_PROOF, PLAN_ID, "actor-1", deps);

    expect(result.ok).toBe(true);
    expect(deps.archiveCommercialPlan).toHaveBeenCalledWith(ADMIN_PROOF, PLAN_ID);
    expect(deps.deleteCommercialPlan).not.toHaveBeenCalled();
    expect(deps.publishAuditEvent).toHaveBeenCalledWith("billing.plan_archived",
      expect.objectContaining({ action: "commercial_plan_archived" })
    );
  });

  it("reports archive failures with the archive message", async () => {
    deps.archiveCommercialPlan.mockRejectedValueOnce(new Error("fk"));

    const result = await archivePlan(ADMIN_PROOF, PLAN_ID, undefined, deps);

    expect(result).toEqual({ ok: false, error: "No se pudo archivar el plan." });
  });
});

describe("deletePlan", () => {
  it("counts the assignments on the server and hard-deletes a plan without any", async () => {
    deps.countPlanAssignments.mockResolvedValueOnce(0);

    const result = await deletePlan(ADMIN_PROOF, PLAN_ID, "actor-1", deps);

    expect(result.ok).toBe(true);
    expect(deps.countPlanAssignments).toHaveBeenCalledWith(ADMIN_PROOF, PLAN_ID);
    expect(deps.deleteCommercialPlan).toHaveBeenCalledWith(ADMIN_PROOF, PLAN_ID);
    expect(deps.archiveCommercialPlan).not.toHaveBeenCalled();
    expect(deps.publishAuditEvent).toHaveBeenCalledWith("billing.plan_deleted",
      expect.objectContaining({ action: "commercial_plan_deleted" })
    );
  });

  it("refuses to delete a plan that still has assignments, without deleting or archiving it", async () => {
    deps.countPlanAssignments.mockResolvedValueOnce(2);

    const result = await deletePlan(ADMIN_PROOF, PLAN_ID, "actor-1", deps);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/archív/i);
    expect(deps.deleteCommercialPlan).not.toHaveBeenCalled();
    expect(deps.archiveCommercialPlan).not.toHaveBeenCalled();
  });

  it("reports failures of the delete with the delete message", async () => {
    deps.countPlanAssignments.mockResolvedValueOnce(0);
    deps.deleteCommercialPlan.mockRejectedValueOnce(new Error("fk"));

    const result = await deletePlan(ADMIN_PROOF, PLAN_ID, undefined, deps);

    expect(result).toEqual({ ok: false, error: "No se pudo eliminar el plan." });
  });
});
