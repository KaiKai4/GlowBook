import { beforeEach, describe, expect, it, vi } from "vitest";
import { findCommercialAddons } from "../data/commercial-addons.repo";
import {
  findPlanCatalog,
  savePlanLimit,
  savePlanModule,
} from "../data/commercial-plans.repo";
import { findSubscriptionRows, type AssignmentRow } from "../data/salon-subscriptions.repo";
import { recordPlatformAction } from "@/features/platform/use-cases/platform-audit";
import type { CommercialPlan } from "../domain/commercial-plan";
import { err, ok } from "@/infra/result";
import { plan } from "@/test/billing-plan-fixtures";
import {
  getCommercialPlansPage,
  getPlanCatalogSummary,
  saveCommercialPlanLimitsBatch,
  saveCommercialPlanModulesBatch,
} from "./commercial-plans";

// Lecturas del catálogo de planes para el panel y escrituras en lote de módulos
// y límites de un plan. Cada lote valida el plan antes de guardar cualquier fila.

vi.mock("../data/commercial-plans.repo", () => ({
  archiveCommercialPlan: vi.fn(),
  deleteCommercialPlan: vi.fn(),
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
vi.mock("@/features/platform/use-cases/platform-audit", () => ({
  recordPlatformAction: vi.fn(async () => []),
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
const savePlanModuleMock = vi.mocked(savePlanModule);
const savePlanLimitMock = vi.mocked(savePlanLimit);
const auditMock = vi.mocked(recordPlatformAction);

beforeEach(() => {
  vi.clearAllMocks();
  savePlanModuleMock.mockResolvedValue(undefined);
  savePlanLimitMock.mockResolvedValue(undefined);
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

    expect(await getPlanCatalogSummary()).toEqual([
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

    const page = await getCommercialPlansPage();

    expect(page.plans.map((item) => item.id)).toEqual(["plan-a", "plan-b"]);
    expect(page.assignmentsByPlan).toEqual({ "plan-a": 2, "plan-b": 1 });
  });

  it("devuelve conteos vacíos cuando ningún plan tiene asignaciones", async () => {
    const page = await getCommercialPlansPage();

    expect(page.assignmentsByPlan).toEqual({});
    expect(page.plans).toEqual([]);
  });
});

describe("saveCommercialPlanModulesBatch", () => {
  it("rechaza un plan inválido y una lista de módulos vacía sin guardar", async () => {
    expect(await saveCommercialPlanModulesBatch({ planId: "x", allModuleKeys: ["reports"] })).toEqual(
      err("Selecciona un plan.")
    );
    expect(await saveCommercialPlanModulesBatch({ planId: PLAN_ID, allModuleKeys: [] })).toEqual(
      err("No hay modulos para guardar.")
    );
    expect(savePlanModuleMock).not.toHaveBeenCalled();
  });

  it("guarda cada módulo marcando como habilitados solo los indicados, sin espacios", async () => {
    const result = await saveCommercialPlanModulesBatch(
      {
        planId: PLAN_ID,
        enabledModuleKeys: [" appointments ", "reports"],
        allModuleKeys: ["appointments", "reports", "employees"],
      },
      ACTOR_ID
    );

    expect(result).toEqual(ok(undefined));
    expect(savePlanModuleMock.mock.calls).toEqual([
      [{ planId: PLAN_ID, moduleKey: "appointments", enabled: true }],
      [{ planId: PLAN_ID, moduleKey: "reports", enabled: true }],
      [{ planId: PLAN_ID, moduleKey: "employees", enabled: false }],
    ]);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: ACTOR_ID,
        action: "commercial_plan_module_saved",
        targetResourceId: PLAN_ID,
      })
    );
  });

  it("deja todos los módulos apagados cuando no llega ninguno habilitado", async () => {
    await saveCommercialPlanModulesBatch({ planId: PLAN_ID, allModuleKeys: ["reports"] });

    expect(savePlanModuleMock).toHaveBeenCalledWith({ planId: PLAN_ID, moduleKey: "reports", enabled: false });
  });

  it("devuelve el prefijo propio si algún módulo no se puede guardar, sin auditar", async () => {
    savePlanModuleMock.mockRejectedValueOnce(new Error("upsert rechazado"));

    const result = await saveCommercialPlanModulesBatch({ planId: PLAN_ID, allModuleKeys: ["reports"] });

    expect(result).toEqual(err(expect.stringContaining("No se pudieron guardar los modulos del plan.")));
    expect(auditMock).not.toHaveBeenCalled();
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
    expect(await saveCommercialPlanLimitsBatch({ planId: "x", limits: [limit] })).toEqual(err("Selecciona un plan."));
    expect(await saveCommercialPlanLimitsBatch({ planId: PLAN_ID, limits: [] })).toEqual(
      err("No hay límites para guardar.")
    );
    expect(await saveCommercialPlanLimitsBatch({ planId: PLAN_ID, limits: [{ ...limit, metricKey: "  " }] })).toEqual(
      err("Selecciona un límite.")
    );
    expect(savePlanLimitMock).not.toHaveBeenCalled();
  });

  it("guarda cada límite asociado al plan y audita la acción en lote", async () => {
    const result = await saveCommercialPlanLimitsBatch({ planId: PLAN_ID, limits: [limit] }, ACTOR_ID);

    expect(result).toEqual(ok(undefined));
    expect(savePlanLimitMock).toHaveBeenCalledWith({
      metricKey: "appointments_monthly",
      maxValue: 100,
      enforcementMode: "block",
      warningThreshold: 90,
      countScope: "monthly",
      planId: PLAN_ID,
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: ACTOR_ID, action: "commercial_plan_limit_saved", targetResourceId: PLAN_ID })
    );
  });

  it("aplica los valores por defecto cuando el límite llega sin modo, umbral ni alcance", async () => {
    await saveCommercialPlanLimitsBatch({ planId: PLAN_ID, limits: [{ metricKey: "employees_active" }] });

    expect(savePlanLimitMock).toHaveBeenCalledWith({
      metricKey: "employees_active",
      maxValue: null,
      enforcementMode: "warn",
      warningThreshold: 80,
      countScope: "current",
      planId: PLAN_ID,
    });
  });

  it("rechaza un umbral fuera de 1 a 100 sin guardar", async () => {
    const badThreshold = await saveCommercialPlanLimitsBatch({
      planId: PLAN_ID,
      limits: [{ ...limit, warningThreshold: 101 }],
    });

    expect(badThreshold.ok).toBe(false);
    expect(savePlanLimitMock).not.toHaveBeenCalled();
  });

  it("un máximo vacío se guarda como null (sin límite), no como 0", async () => {
    await saveCommercialPlanLimitsBatch({ planId: PLAN_ID, limits: [{ metricKey: "employees_active", maxValue: "" }] });

    expect(savePlanLimitMock).toHaveBeenCalledWith(expect.objectContaining({ maxValue: null }));
  });

  it("devuelve el prefijo propio si algún límite no se puede guardar, sin auditar", async () => {
    savePlanLimitMock.mockRejectedValueOnce(new Error("upsert rechazado"));

    const result = await saveCommercialPlanLimitsBatch({ planId: PLAN_ID, limits: [limit] });

    expect(result).toEqual(err(expect.stringContaining("No se pudieron guardar los límites del plan.")));
    expect(auditMock).not.toHaveBeenCalled();
  });
});
