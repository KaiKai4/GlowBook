import { beforeEach, describe, expect, it, vi } from "vitest";
import { findCommercialAddons } from "../data/commercial-addons.repo";
import { findPlanCatalog } from "../data/commercial-plans.repo";
import { findSubscriptionRows } from "../data/salon-subscriptions.repo";
import type { AssignmentRow } from "../data/salon-subscriptions.rows";
import type { CommercialPlan } from "../domain/commercial-plan";
import { err, ok } from "@/infra/result";
import { plan } from "@/test/billing-plan-fixtures";
import { fakeCommercialPlanDeps } from "@/test/billing-command-fakes";
import {
  getCommercialPlansPage,
  getPlanCatalogSummary,
  saveCommercialPlanLimitsBatch,
  saveCommercialPlanModulesBatch,
} from "./commercial-plans";
import { issuePlatformAdminProof } from "@/infra/auth/platform-admin-proof";
const ADMIN_PROOF = issuePlatformAdminProof("admin-1");

// Lecturas del catálogo de planes para el panel (vi.mock de data/) y escrituras en
// lote de módulos y límites de un plan (fakes inyectados). Cada lote valida el plan
// antes de guardar cualquier fila.

vi.mock("../data/commercial-plans.repo", () => ({
  archiveCommercialPlan: vi.fn(),
  deleteCommercialPlan: vi.fn(),
  countPlanAssignments: vi.fn(),
  findPlanCatalog: vi.fn(),
  saveCommercialPlan: vi.fn(),
  savePlanLimit: vi.fn(),
  savePlanModule: vi.fn(),
}));
vi.mock("../data/commercial-addons.repo", () => ({
  findCommercialAddons: vi.fn(),
}));
vi.mock("../data/salon-subscriptions.repo", () => ({
  findSubscriptionRows: vi.fn(),
}));
vi.mock("@/features/audit", () => ({
  publishAuditEvent: vi.fn(async () => []),
}));

const PLAN_ID = "00000000-0000-4000-8000-0000000000f1";

function assignmentFor(salonId: string, planId: string): AssignmentRow {
  return {
    id: `asg-${salonId}`,
    salon_id: salonId,
    plan_id: planId,
    status: "active",
    starts_at: "2026-01-01",
    ends_at: null,
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    notes: "",
  };
}
const ACTOR_ID = "00000000-0000-4000-8000-0000000000f2";

const findCatalogMock = vi.mocked(findPlanCatalog);
const findAddonsMock = vi.mocked(findCommercialAddons);
const findSubscriptionsMock = vi.mocked(findSubscriptionRows);

let deps: ReturnType<typeof fakeCommercialPlanDeps>;

beforeEach(() => {
  vi.clearAllMocks();
  deps = fakeCommercialPlanDeps();
  findCatalogMock.mockResolvedValue({ modules: [], metrics: [], plans: [] });
  findAddonsMock.mockResolvedValue([]);
  findSubscriptionsMock.mockResolvedValue({ assignments: [], overrides: [], alerts: [] });
});

describe("getPlanCatalogSummary", () => {
  it("expone solo los campos comerciales básicos de cada plan del catálogo", async () => {
    const full: CommercialPlan = plan({
      id: "plan-basic",
      name: "Básico",
      currency: "USD",
      monthlyPrice: 20,
      trialDays: 14,
      status: "active",
      description: "Descripción larga",
    });
    findCatalogMock.mockResolvedValueOnce({ modules: [], metrics: [], plans: [full] });

    expect(await getPlanCatalogSummary(ADMIN_PROOF)).toEqual([
      { id: "plan-basic", name: "Básico", currency: "USD", monthlyPrice: 20, trialDays: 14, status: "active" },
    ]);
  });
});

describe("getCommercialPlansPage", () => {
  it("cuenta las asignaciones por plan y reúne catálogo, extras y planes", async () => {
    const basic = plan({ id: "plan-a", name: "Básico" });
    const pro = plan({ id: "plan-b", name: "Pro" });
    findCatalogMock.mockResolvedValueOnce({ modules: [], metrics: [], plans: [basic, pro] });
    findAddonsMock.mockResolvedValueOnce([]);
    findSubscriptionsMock.mockResolvedValueOnce({
      assignments: [
        assignmentFor("s1", "plan-a"),
        assignmentFor("s2", "plan-a"),
        assignmentFor("s3", "plan-b"),
      ],
      overrides: [],
      alerts: [],
    });

    const page = await getCommercialPlansPage(ADMIN_PROOF);

    expect(page.plans.map((item) => item.id)).toEqual(["plan-a", "plan-b"]);
    expect(page.assignmentsByPlan).toEqual({ "plan-a": 2, "plan-b": 1 });
  });

  it("devuelve conteos vacíos cuando ningún plan tiene asignaciones", async () => {
    const page = await getCommercialPlansPage(ADMIN_PROOF);

    expect(page.assignmentsByPlan).toEqual({});
    expect(page.plans).toEqual([]);
  });
});

describe("saveCommercialPlanModulesBatch", () => {
  it("rechaza un plan inválido y una lista de módulos vacía sin guardar", async () => {
    expect(await saveCommercialPlanModulesBatch(ADMIN_PROOF, { planId: "x", allModuleKeys: ["reports"] }, undefined, deps)).toEqual(
      err("Selecciona un plan.")
    );
    expect(await saveCommercialPlanModulesBatch(ADMIN_PROOF, { planId: PLAN_ID, allModuleKeys: [] }, undefined, deps)).toEqual(
      err("No hay módulos para guardar.")
    );
    expect(deps.savePlanModule).not.toHaveBeenCalled();
  });

  it("guarda cada módulo marcando como habilitados solo los indicados, sin espacios", async () => {
    const result = await saveCommercialPlanModulesBatch(ADMIN_PROOF, 
      {
        planId: PLAN_ID,
        enabledModuleKeys: [" appointments ", "reports"],
        allModuleKeys: ["appointments", "reports", "employees"],
      },
      ACTOR_ID,
      deps
    );

    expect(result).toEqual(ok(undefined));
    expect(deps.savePlanModule.mock.calls).toEqual([
      [ADMIN_PROOF, { planId: PLAN_ID, moduleKey: "appointments", enabled: true }],
      [ADMIN_PROOF, { planId: PLAN_ID, moduleKey: "reports", enabled: true }],
      [ADMIN_PROOF, { planId: PLAN_ID, moduleKey: "employees", enabled: false }],
    ]);
    expect(deps.publishAuditEvent).toHaveBeenCalledWith("billing.plan_module_saved",
      expect.objectContaining({
        actorUserId: ACTOR_ID,
        action: "commercial_plan_module_saved",
        targetResourceId: PLAN_ID,
      })
    );
  });

  it("deja todos los módulos apagados cuando no llega ninguno habilitado", async () => {
    await saveCommercialPlanModulesBatch(ADMIN_PROOF, { planId: PLAN_ID, allModuleKeys: ["reports"] }, undefined, deps);

    expect(deps.savePlanModule).toHaveBeenCalledWith(ADMIN_PROOF, { planId: PLAN_ID, moduleKey: "reports", enabled: false });
  });

  it("devuelve el prefijo propio si algún módulo no se puede guardar, sin auditar", async () => {
    deps.savePlanModule.mockRejectedValueOnce(new Error("upsert rechazado"));

    const result = await saveCommercialPlanModulesBatch(ADMIN_PROOF, { planId: PLAN_ID, allModuleKeys: ["reports"] }, undefined, deps);

    expect(result).toEqual(err(expect.stringContaining("No se pudieron guardar los módulos del plan.")));
    expect(deps.publishAuditEvent).not.toHaveBeenCalled();
  });
});

describe("saveCommercialPlanLimitsBatch", () => {
  const limit = {
    metricKey: "appointments_monthly",
    maxValue: 100,
    enforcementMode: "block",
    warningThreshold: 90,
    countScope: "monthly",
  } as const;

  it("rechaza un plan inválido, una lista vacía o una métrica vacía sin guardar", async () => {
    expect(await saveCommercialPlanLimitsBatch(ADMIN_PROOF, { planId: "x", limits: [limit] }, undefined, deps)).toEqual(err("Selecciona un plan."));
    expect(await saveCommercialPlanLimitsBatch(ADMIN_PROOF, { planId: PLAN_ID, limits: [] }, undefined, deps)).toEqual(
      err("No hay límites para guardar.")
    );
    expect(await saveCommercialPlanLimitsBatch(ADMIN_PROOF, { planId: PLAN_ID, limits: [{ ...limit, metricKey: "  " }] }, undefined, deps)).toEqual(
      err("Selecciona un límite.")
    );
    expect(deps.savePlanLimit).not.toHaveBeenCalled();
  });

  it("guarda cada límite asociado al plan y audita la acción en lote", async () => {
    const result = await saveCommercialPlanLimitsBatch(ADMIN_PROOF, { planId: PLAN_ID, limits: [limit] }, ACTOR_ID, deps);

    expect(result).toEqual(ok(undefined));
    expect(deps.savePlanLimit).toHaveBeenCalledWith(ADMIN_PROOF, {
      metricKey: "appointments_monthly",
      maxValue: 100,
      enforcementMode: "block",
      warningThreshold: 90,
      countScope: "monthly",
      planId: PLAN_ID,
    });
    expect(deps.publishAuditEvent).toHaveBeenCalledWith("billing.plan_limit_saved",
      expect.objectContaining({ actorUserId: ACTOR_ID, action: "commercial_plan_limit_saved", targetResourceId: PLAN_ID })
    );
  });

  it("aplica los valores por defecto cuando el límite llega sin modo, umbral ni alcance", async () => {
    await saveCommercialPlanLimitsBatch(ADMIN_PROOF, { planId: PLAN_ID, limits: [{ metricKey: "employees_active" }] }, undefined, deps);

    expect(deps.savePlanLimit).toHaveBeenCalledWith(ADMIN_PROOF, {
      metricKey: "employees_active",
      maxValue: null,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "current",
      planId: PLAN_ID,
    });
  });

  it("rechaza un umbral fuera de 1 a 100 sin guardar", async () => {
    const badThreshold = await saveCommercialPlanLimitsBatch(ADMIN_PROOF, 
      {
        planId: PLAN_ID,
        limits: [{ ...limit, warningThreshold: 101 }],
      },
      undefined,
      deps
    );

    expect(badThreshold.ok).toBe(false);
    expect(deps.savePlanLimit).not.toHaveBeenCalled();
  });

  it("un máximo vacío se guarda como null (sin límite), no como 0", async () => {
    await saveCommercialPlanLimitsBatch(ADMIN_PROOF, { planId: PLAN_ID, limits: [{ metricKey: "employees_active", maxValue: "" }] }, undefined, deps);

    expect(deps.savePlanLimit).toHaveBeenCalledWith(ADMIN_PROOF, expect.objectContaining({ maxValue: null }));
  });

  it("devuelve el prefijo propio si algún límite no se puede guardar, sin auditar", async () => {
    deps.savePlanLimit.mockRejectedValueOnce(new Error("upsert rechazado"));

    const result = await saveCommercialPlanLimitsBatch(ADMIN_PROOF, { planId: PLAN_ID, limits: [limit] }, undefined, deps);

    expect(result).toEqual(err(expect.stringContaining("No se pudieron guardar los límites del plan.")));
    expect(deps.publishAuditEvent).not.toHaveBeenCalled();
  });
});
