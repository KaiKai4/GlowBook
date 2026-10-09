import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { PublicError } from "@/infra/public-error";
import {
  archiveCommercialAddon,
  countAddonAssignments,
  deleteCommercialAddon,
  saveCommercialAddon,
} from "../data/commercial-addons.repo";
import {
  archiveCommercialPlan,
  deleteCommercialPlan,
  savePlanLimit,
  savePlanModule,
  saveCommercialPlan,
} from "../data/commercial-plans.repo";
import { publishAuditEvent } from "@/features/audit";
import { removeCommercialAddonConfig, saveCommercialAddonConfig } from "./commercial-addons";
import {
  removeCommercialPlanConfig,
  saveCommercialPlanConfig,
  saveCommercialPlanLimitsBatch,
  saveCommercialPlanModulesBatch,
} from "./commercial-plans";

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

const PLAN = { id: PLAN_ID } as never;
const VALID_ADDON = { name: "Turbo", kind: "limit_boost" as const, metricKey: "appointments", limitDelta: 10, monthlyPrice: 5 };

function pgError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("commercial addons: validacion y errores publicos", () => {
  it("un nombre demasiado corto se devuelve como primer mensaje de validacion, sin escribir", async () => {
    const result = await saveCommercialAddonConfig({ name: "A", code: "x" } as never, ACTOR);

    expect(result).toEqual({ ok: false, error: "Escribe el nombre del extra." });
    expect(saveCommercialAddon).not.toHaveBeenCalled();
  });

  it("guarda el extra normalizando la clave y audita la accion", async () => {
    vi.mocked(saveCommercialAddon).mockResolvedValue("addon-1");

    const result = await saveCommercialAddonConfig(
      {
        name: "Turbo Cabello",
        kind: "limit_boost",
        metricKey: "appointments",
        limitDelta: 10,
        currency: "usd",
        monthlyPrice: 5,
      },
      ACTOR
    );

    expect(result).toEqual({ ok: true, value: "addon-1" });
    expect(saveCommercialAddon).toHaveBeenCalledWith(
      expect.objectContaining({ code: "turbo_cabello", currency: "USD", limitDelta: 10 })
    );
    expect(publishAuditEvent).toHaveBeenCalledWith("billing.addon_saved", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_addon_saved", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: "addon-1" }));
  });

  it("un error de dominio de la base (RAISE seguro) se muestra tal cual", async () => {
    vi.mocked(saveCommercialAddon).mockRejectedValue(
      pgError("P0001", "Ya existe un extra con ese código.")
    );

    const result = await saveCommercialAddonConfig(VALID_ADDON, ACTOR);

    expect(result).toEqual({ ok: false, error: "Ya existe un extra con ese código." });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("un error interno de la base usa el mensaje de respaldo y no filtra el SQL", async () => {
    const failure = pgError("42P01", 'relation "commercial_addons" does not exist');
    vi.mocked(saveCommercialAddon).mockRejectedValue(failure);

    const result = await saveCommercialAddonConfig(VALID_ADDON, ACTOR);

    expect(result).toEqual({ ok: false, error: "No se pudo guardar el extra." });
    expect(captureError).toHaveBeenCalledWith(failure, { module: "errors", action: "public-message" });
  });

  it("archiva el extra si tiene asignaciones y lo elimina si no", async () => {
    vi.mocked(countAddonAssignments).mockResolvedValueOnce(2);
    expect(await removeCommercialAddonConfig(ADDON_ID, ACTOR)).toEqual({ ok: true, value: undefined });
    expect(archiveCommercialAddon).toHaveBeenCalledWith(ADDON_ID);
    expect(publishAuditEvent).toHaveBeenLastCalledWith("billing.addon_archived", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_addon_archived", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: ADDON_ID }));

    vi.mocked(countAddonAssignments).mockResolvedValueOnce(0);
    expect(await removeCommercialAddonConfig(ADDON_ID, ACTOR)).toEqual({ ok: true, value: undefined });
    expect(deleteCommercialAddon).toHaveBeenCalledWith(ADDON_ID);
    expect(publishAuditEvent).toHaveBeenLastCalledWith("billing.addon_deleted", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_addon_deleted", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: ADDON_ID }));
  });

  it("si el borrado falla devuelve el mensaje de respaldo de eliminacion", async () => {
    vi.mocked(countAddonAssignments).mockResolvedValue(0);
    vi.mocked(deleteCommercialAddon).mockRejectedValue(new Error("timeout"));

    const result = await removeCommercialAddonConfig(ADDON_ID, ACTOR);

    expect(result).toEqual({ ok: false, error: "No se pudo eliminar el extra." });
  });
});

describe("commercial plans: validacion y errores publicos", () => {
  it("un plan sin nombre valido devuelve el mensaje del esquema y no escribe", async () => {
    const result = await saveCommercialPlanConfig({ name: "P", monthlyPrice: 10 }, ACTOR);

    expect(result).toEqual({ ok: false, error: "Escribe el nombre del plan." });
    expect(saveCommercialPlan).not.toHaveBeenCalled();
  });

  it("un precio negativo devuelve su mensaje de validacion", async () => {
    const result = await saveCommercialPlanConfig({ name: "Pro", monthlyPrice: -1 }, ACTOR);

    expect(result).toEqual({ ok: false, error: "El precio no puede ser negativo." });
  });

  it("guarda el plan con el codigo normalizado y devuelve su id", async () => {
    vi.mocked(saveCommercialPlan).mockResolvedValue("plan-9");

    const result = await saveCommercialPlanConfig(
      { name: "Plan Pro", code: "Plan Pro", monthlyPrice: 20, currency: "eur" },
      ACTOR
    );

    expect(result).toEqual({ ok: true, value: "plan-9" });
    expect(saveCommercialPlan).toHaveBeenCalledWith(
      expect.objectContaining({ code: "plan_pro", currency: "EUR" })
    );
    expect(publishAuditEvent).toHaveBeenCalledWith("billing.plan_saved", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_plan_saved", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: "plan-9" }));
  });

  it("si la escritura falla devuelve el mensaje de respaldo del plan", async () => {
    vi.mocked(saveCommercialPlan).mockRejectedValue(new Error("connection reset"));

    const result = await saveCommercialPlanConfig({ name: "Plan Pro", monthlyPrice: 20 });

    expect(result).toEqual({ ok: false, error: "No se pudo guardar el plan." });
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("archiva el plan con asignaciones y lo elimina sin ellas", async () => {
    expect(await removeCommercialPlanConfig(PLAN, true, ACTOR)).toEqual({ ok: true, value: undefined });
    expect(archiveCommercialPlan).toHaveBeenCalledWith(PLAN_ID);
    expect(publishAuditEvent).toHaveBeenLastCalledWith("billing.plan_archived", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_plan_archived", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: PLAN_ID }));

    expect(await removeCommercialPlanConfig(PLAN, false, ACTOR)).toEqual({ ok: true, value: undefined });
    expect(deleteCommercialPlan).toHaveBeenCalledWith(PLAN_ID);
    expect(publishAuditEvent).toHaveBeenLastCalledWith("billing.plan_deleted", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_plan_deleted", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: PLAN_ID }));
  });

  it("un mensaje de dominio (PublicError) del borrado del plan llega al usuario tal cual", async () => {
    vi.mocked(deleteCommercialPlan).mockRejectedValue(new PublicError("No se puede eliminar un plan activo."));

    const result = await removeCommercialPlanConfig(PLAN, false, ACTOR);

    expect(result).toEqual({ ok: false, error: "No se puede eliminar un plan activo." });
    expect(captureError).not.toHaveBeenCalled();
  });
});

describe("commercial plans: modulos y limites en lote", () => {
  it("valida el plan y la lista de modulos antes de escribir", async () => {
    expect(await saveCommercialPlanModulesBatch({ planId: "no-uuid", allModuleKeys: ["a"] }, ACTOR)).toEqual({
      ok: false,
      error: "Selecciona un plan.",
    });
    expect(await saveCommercialPlanModulesBatch({ planId: PLAN_ID, allModuleKeys: [] }, ACTOR)).toEqual({
      ok: false,
      error: "No hay modulos para guardar.",
    });
    expect(savePlanModule).not.toHaveBeenCalled();
  });

  it("guarda cada modulo marcando los habilitados y audita el lote", async () => {
    const result = await saveCommercialPlanModulesBatch(
      { planId: PLAN_ID, allModuleKeys: ["inventory", "retail"], enabledModuleKeys: ["retail"] },
      ACTOR
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(savePlanModule).toHaveBeenCalledWith({ planId: PLAN_ID, moduleKey: "inventory", enabled: false });
    expect(savePlanModule).toHaveBeenCalledWith({ planId: PLAN_ID, moduleKey: "retail", enabled: true });
    expect(publishAuditEvent).toHaveBeenCalledWith("billing.plan_module_saved", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_plan_module_saved", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: PLAN_ID }));
  });

  it("si un modulo no se puede guardar devuelve el mensaje de respaldo del lote", async () => {
    vi.mocked(savePlanModule).mockRejectedValue(new Error("boom"));

    const result = await saveCommercialPlanModulesBatch(
      { planId: PLAN_ID, allModuleKeys: ["inventory"] },
      ACTOR
    );

    expect(result).toEqual({ ok: false, error: "No se pudieron guardar los modulos del plan." });
  });

  it("valida el plan y la lista de limites antes de escribir", async () => {
    expect(await saveCommercialPlanLimitsBatch({ planId: "x", limits: [] }, ACTOR)).toEqual({
      ok: false,
      error: "Selecciona un plan.",
    });
    expect(await saveCommercialPlanLimitsBatch({ planId: PLAN_ID, limits: [] }, ACTOR)).toEqual({
      ok: false,
      error: "No hay límites para guardar.",
    });
    expect(savePlanLimit).not.toHaveBeenCalled();
  });

  it("guarda los limites del plan y audita", async () => {
    const result = await saveCommercialPlanLimitsBatch(
      { planId: PLAN_ID, limits: [{ metricKey: "appointments", maxValue: "100" }] },
      ACTOR
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(savePlanLimit).toHaveBeenCalledWith(expect.objectContaining({ metricKey: "appointments", planId: PLAN_ID }));
    expect(publishAuditEvent).toHaveBeenCalledWith("billing.plan_limit_saved", expect.objectContaining({ actorUserId: ACTOR, action: "commercial_plan_limit_saved", status: "succeeded", targetResourceType: "commercial_plan", targetResourceId: PLAN_ID }));
  });

  it("si un limite no se puede guardar devuelve el mensaje de respaldo", async () => {
    vi.mocked(savePlanLimit).mockRejectedValue(new Error("boom"));

    const result = await saveCommercialPlanLimitsBatch(
      { planId: PLAN_ID, limits: [{ metricKey: "appointments" }] },
      ACTOR
    );

    expect(result).toEqual({ ok: false, error: "No se pudieron guardar los límites del plan." });
  });
});
