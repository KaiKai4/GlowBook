import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { PublicError } from "@/infra/public-error";
import { fakeCommercialAddonDeps, fakeCommercialPlanDeps } from "@/test/billing-command-fakes";
import { removeCommercialAddonConfig, saveCommercialAddonConfig } from "./commercial-addons";
import {
  archivePlan,
  deletePlan,
  saveCommercialPlanConfig,
  saveCommercialPlanLimitsBatch,
  saveCommercialPlanModulesBatch,
} from "./commercial-plans";
import { issuePlatformAdminProof } from "@/infra/auth/platform-admin-proof";
const ADMIN_PROOF = issuePlatformAdminProof("admin-1");

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/audit", () => ({ publishAuditEvent: vi.fn(async () => []) }));
vi.mock("./billing-shared", () => ({
  commercialPlanAudit: (actorUserId: string | null | undefined, targetResourceId: string) => ({
    actorUserId: actorUserId ?? null,
    status: "succeeded",
    targetResourceType: "commercial_plan",
    targetResourceId,
  }),
  normalizeKey: (value: string) => value.trim().toLowerCase().replace(/\s+/g, "_"),
}));
vi.mock("../data/commercial-addons.repo", () => ({
  archiveCommercialAddon: vi.fn(),
  countAddonAssignments: vi.fn(),
  deleteCommercialAddon: vi.fn(),
  saveCommercialAddon: vi.fn(),
  findCommercialAddons: vi.fn(),
}));
vi.mock("../data/commercial-plans.repo", () => ({
  archiveCommercialPlan: vi.fn(),
  countPlanAssignments: vi.fn(),
  deleteCommercialPlan: vi.fn(),
  findPlanCatalog: vi.fn(),
  saveCommercialPlan: vi.fn(),
  savePlanLimit: vi.fn(),
  savePlanModule: vi.fn(),
}));
vi.mock("../data/salon-subscriptions.repo", () => ({ findSubscriptionRows: vi.fn() }));

const ACTOR = "00000000-0000-4000-8000-0000000000ad";
const PLAN_ID = "00000000-0000-4000-8000-0000000000b1";
const ADDON_ID = "00000000-0000-4000-8000-000000000a01";

const VALID_ADDON = { name: "Turbo", kind: "limit_boost" as const, metricKey: "appointments", limitDelta: 10, monthlyPrice: 5 };

function pgError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

let addonDeps: ReturnType<typeof fakeCommercialAddonDeps>;
let planDeps: ReturnType<typeof fakeCommercialPlanDeps>;

beforeEach(() => {
  vi.clearAllMocks();
  addonDeps = fakeCommercialAddonDeps();
  planDeps = fakeCommercialPlanDeps();
});

describe("commercial addons: validación y errores publicos", () => {
  it("un nombre demasiado corto se devuelve como primer mensaje de validación, sin escribir", async () => {
    const result = await saveCommercialAddonConfig(ADMIN_PROOF, { name: "A", code: "x" } as never, ACTOR, addonDeps);

    expect(result).toEqual({ ok: false, error: "Escribe el nombre del extra." });
    expect(addonDeps.saveCommercialAddon).not.toHaveBeenCalled();
  });

  it("guarda el extra normalizando la clave y audita la acción", async () => {
    addonDeps.saveCommercialAddon.mockResolvedValue("addon-1");

    const result = await saveCommercialAddonConfig(ADMIN_PROOF, 
      {
        name: "Turbo Cabello",
        kind: "limit_boost",
        metricKey: "appointments",
        limitDelta: 10,
        currency: "usd",
        monthlyPrice: 5,
      },
      ACTOR,
      addonDeps
    );

    expect(result).toEqual({ ok: true, value: "addon-1" });
    expect(addonDeps.saveCommercialAddon).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({ code: "turbo_cabello", currency: "USD", limitDelta: 10 })
    );
    expect(addonDeps.publishAuditEvent).toHaveBeenCalledWith("billing.addon_saved", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_addon_saved", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: "addon-1" }));
  });

  it("un error de dominio de la base (RAISE seguro) se muestra tal cual", async () => {
    addonDeps.saveCommercialAddon.mockRejectedValue(
      pgError("P0001", "Ya existe un extra con ese código.")
    );

    const result = await saveCommercialAddonConfig(ADMIN_PROOF, VALID_ADDON, ACTOR, addonDeps);

    expect(result).toEqual({ ok: false, error: "Ya existe un extra con ese código." });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("un error interno de la base usa el mensaje de respaldo y no filtra el SQL", async () => {
    const failure = pgError("42P01", 'relation "commercial_addons" does not exist');
    addonDeps.saveCommercialAddon.mockRejectedValue(failure);

    const result = await saveCommercialAddonConfig(ADMIN_PROOF, VALID_ADDON, ACTOR, addonDeps);

    expect(result).toEqual({ ok: false, error: "No se pudo guardar el extra." });
    expect(captureError).toHaveBeenCalledWith(failure, { module: "errors", action: "public-message" });
  });

  it("archiva el extra si tiene asignaciones y lo elimina si no", async () => {
    addonDeps.countAddonAssignments.mockResolvedValueOnce(2);
    expect(await removeCommercialAddonConfig(ADMIN_PROOF, ADDON_ID, ACTOR, addonDeps)).toEqual({ ok: true, value: undefined });
    expect(addonDeps.archiveCommercialAddon).toHaveBeenCalledWith(ADMIN_PROOF, ADDON_ID);
    expect(addonDeps.publishAuditEvent).toHaveBeenLastCalledWith("billing.addon_archived", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_addon_archived", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: ADDON_ID }));

    addonDeps.countAddonAssignments.mockResolvedValueOnce(0);
    expect(await removeCommercialAddonConfig(ADMIN_PROOF, ADDON_ID, ACTOR, addonDeps)).toEqual({ ok: true, value: undefined });
    expect(addonDeps.deleteCommercialAddon).toHaveBeenCalledWith(ADMIN_PROOF, ADDON_ID);
    expect(addonDeps.publishAuditEvent).toHaveBeenLastCalledWith("billing.addon_deleted", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_addon_deleted", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: ADDON_ID }));
  });

  it("si el borrado falla devuelve el mensaje de respaldo de eliminación", async () => {
    addonDeps.countAddonAssignments.mockResolvedValue(0);
    addonDeps.deleteCommercialAddon.mockRejectedValue(new Error("timeout"));

    const result = await removeCommercialAddonConfig(ADMIN_PROOF, ADDON_ID, ACTOR, addonDeps);

    expect(result).toEqual({ ok: false, error: "No se pudo eliminar el extra." });
  });
});

describe("commercial plans: validación y errores publicos", () => {
  it("un plan sin nombre válido devuelve el mensaje del esquema y no escribe", async () => {
    const result = await saveCommercialPlanConfig(ADMIN_PROOF, { name: "P", monthlyPrice: 10 }, ACTOR, planDeps);

    expect(result).toEqual({ ok: false, error: "Escribe el nombre del plan." });
    expect(planDeps.saveCommercialPlan).not.toHaveBeenCalled();
  });

  it("un precio negativo devuelve su mensaje de validación", async () => {
    const result = await saveCommercialPlanConfig(ADMIN_PROOF, { name: "Pro", monthlyPrice: -1 }, ACTOR, planDeps);

    expect(result).toEqual({ ok: false, error: "El precio no puede ser negativo." });
  });

  it("guarda el plan con el código normalizado y devuelve su id", async () => {
    planDeps.saveCommercialPlan.mockResolvedValue("plan-9");

    const result = await saveCommercialPlanConfig(ADMIN_PROOF, 
      { name: "Plan Pro", code: "Plan Pro", monthlyPrice: 20, currency: "eur" },
      ACTOR,
      planDeps
    );

    expect(result).toEqual({ ok: true, value: "plan-9" });
    expect(planDeps.saveCommercialPlan).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({ code: "plan_pro", currency: "EUR" })
    );
    expect(planDeps.publishAuditEvent).toHaveBeenCalledWith("billing.plan_saved", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_plan_saved", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: "plan-9" }));
  });

  it("si la escritura falla devuelve el mensaje de respaldo del plan", async () => {
    planDeps.saveCommercialPlan.mockRejectedValue(new Error("connection reset"));

    const result = await saveCommercialPlanConfig(ADMIN_PROOF, { name: "Plan Pro", monthlyPrice: 20 }, undefined, planDeps);

    expect(result).toEqual({ ok: false, error: "No se pudo guardar el plan." });
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("archiva el plan y audita la acción", async () => {
    expect(await archivePlan(ADMIN_PROOF, PLAN_ID, ACTOR, planDeps)).toEqual({ ok: true, value: undefined });
    expect(planDeps.archiveCommercialPlan).toHaveBeenCalledWith(ADMIN_PROOF, PLAN_ID);
    expect(planDeps.publishAuditEvent).toHaveBeenLastCalledWith("billing.plan_archived", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_plan_archived", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: PLAN_ID }));
  });

  it("elimina el plan sin asignaciones y audita la acción", async () => {
    planDeps.countPlanAssignments.mockResolvedValueOnce(0);
    expect(await deletePlan(ADMIN_PROOF, PLAN_ID, ACTOR, planDeps)).toEqual({ ok: true, value: undefined });
    expect(planDeps.deleteCommercialPlan).toHaveBeenCalledWith(ADMIN_PROOF, PLAN_ID);
    expect(planDeps.publishAuditEvent).toHaveBeenLastCalledWith("billing.plan_deleted", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_plan_deleted", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: PLAN_ID }));
  });

  it("un mensaje de dominio (PublicError) del borrado del plan llega al usuario tal cual", async () => {
    planDeps.deleteCommercialPlan.mockRejectedValue(new PublicError("No se puede eliminar un plan activo."));

    planDeps.countPlanAssignments.mockResolvedValueOnce(0);
    const result = await deletePlan(ADMIN_PROOF, PLAN_ID, ACTOR, planDeps);

    expect(result).toEqual({ ok: false, error: "No se puede eliminar un plan activo." });
    expect(captureError).not.toHaveBeenCalled();
  });
});

describe("commercial plans: módulos y límites en lote", () => {
  it("válida el plan y la lista de módulos antes de escribir", async () => {
    expect(await saveCommercialPlanModulesBatch(ADMIN_PROOF, { planId: "no-uuid", allModuleKeys: ["a"] }, ACTOR, planDeps)).toEqual({
      ok: false,
      error: "Selecciona un plan.",
    });
    expect(await saveCommercialPlanModulesBatch(ADMIN_PROOF, { planId: PLAN_ID, allModuleKeys: [] }, ACTOR, planDeps)).toEqual({
      ok: false,
      error: "No hay módulos para guardar.",
    });
    expect(planDeps.savePlanModule).not.toHaveBeenCalled();
  });

  it("guarda cada módulo marcando los habilitados y audita el lote", async () => {
    const result = await saveCommercialPlanModulesBatch(ADMIN_PROOF, 
      { planId: PLAN_ID, allModuleKeys: ["inventory", "retail"], enabledModuleKeys: ["retail"] },
      ACTOR,
      planDeps
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(planDeps.savePlanModule).toHaveBeenCalledWith(ADMIN_PROOF, { planId: PLAN_ID, moduleKey: "inventory", enabled: false });
    expect(planDeps.savePlanModule).toHaveBeenCalledWith(ADMIN_PROOF, { planId: PLAN_ID, moduleKey: "retail", enabled: true });
    expect(planDeps.publishAuditEvent).toHaveBeenCalledWith("billing.plan_module_saved", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_plan_module_saved", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: PLAN_ID }));
  });

  it("si un módulo no se puede guardar devuelve el mensaje de respaldo del lote", async () => {
    planDeps.savePlanModule.mockRejectedValue(new Error("boom"));

    const result = await saveCommercialPlanModulesBatch(ADMIN_PROOF, 
      { planId: PLAN_ID, allModuleKeys: ["inventory"] },
      ACTOR,
      planDeps
    );

    expect(result).toEqual({ ok: false, error: "No se pudieron guardar los módulos del plan." });
  });

  it("válida el plan y la lista de límites antes de escribir", async () => {
    expect(await saveCommercialPlanLimitsBatch(ADMIN_PROOF, { planId: "x", limits: [] }, ACTOR, planDeps)).toEqual({
      ok: false,
      error: "Selecciona un plan.",
    });
    expect(await saveCommercialPlanLimitsBatch(ADMIN_PROOF, { planId: PLAN_ID, limits: [] }, ACTOR, planDeps)).toEqual({
      ok: false,
      error: "No hay límites para guardar.",
    });
    expect(planDeps.savePlanLimit).not.toHaveBeenCalled();
  });

  it("guarda los límites del plan y audita", async () => {
    const result = await saveCommercialPlanLimitsBatch(ADMIN_PROOF, 
      { planId: PLAN_ID, limits: [{ metricKey: "appointments", maxValue: "100" }] },
      ACTOR,
      planDeps
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(planDeps.savePlanLimit).toHaveBeenCalledWith(ADMIN_PROOF, expect.objectContaining({ metricKey: "appointments", planId: PLAN_ID }));
    expect(planDeps.publishAuditEvent).toHaveBeenCalledWith("billing.plan_limit_saved", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_plan_limit_saved", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: PLAN_ID }));
  });

  it("si un límite no se puede guardar devuelve el mensaje de respaldo", async () => {
    planDeps.savePlanLimit.mockRejectedValue(new Error("boom"));

    const result = await saveCommercialPlanLimitsBatch(ADMIN_PROOF, 
      { planId: PLAN_ID, limits: [{ metricKey: "appointments" }] },
      ACTOR,
      planDeps
    );

    expect(result).toEqual({ ok: false, error: "No se pudieron guardar los límites del plan." });
  });
});
