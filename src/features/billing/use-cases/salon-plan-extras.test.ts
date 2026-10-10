import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSalonPlanExtrasDeps } from "@/test/billing-command-fakes";
import type { CommercialAddon } from "../domain/salon-extras";
import { err, ok } from "@/infra/result";
import {
  assignSalonAddonConfig,
  cancelSalonExtraConfig,
  saveSalonManualExtraConfig,
} from "./salon-plan-extras";
import { issuePlatformAdminProof } from "@/infra/auth/platform-admin-proof";
const ADMIN_PROOF = issuePlatformAdminProof("admin-1");

// Extras asignados a un salón: el extra de catálogo copia módulo o límite y precio
// al override; el extra manual exige módulo o límite; cancelar cambia el estado.
// Las escrituras reciben fakes tipados por parámetro.

vi.mock("@/features/audit", () => ({
  publishAuditEvent: vi.fn(async () => []),
}));

const SALON_ID = "00000000-0000-4000-8000-0000000000c1";
const ADDON_ID = "00000000-0000-4000-8000-0000000000c2";
const OVERRIDE_ID = "00000000-0000-4000-8000-0000000000c3";
const ACTOR_ID = "00000000-0000-4000-8000-0000000000c4";

function addon(overrides: Partial<CommercialAddon> = {}): CommercialAddon {
  return {
    id: ADDON_ID,
    code: "reportes",
    name: "Reportes",
    description: "",
    kind: "module",
    moduleKey: "reports",
    metricKey: null,
    limitDelta: null,
    currency: "USD",
    monthlyPrice: 10,
    status: "active",
    sortOrder: 0,
    ...overrides,
  };
}

let deps: ReturnType<typeof fakeSalonPlanExtrasDeps>;

beforeEach(() => {
  deps = fakeSalonPlanExtrasDeps();
});

describe("assignSalonAddonConfig", () => {
  it("rechaza un extra que no existe en el catálogo sin escribir el override", async () => {
    deps.findCommercialAddonById.mockResolvedValueOnce(null);

    expect(await assignSalonAddonConfig(ADMIN_PROOF, { salonId: SALON_ID, addonId: ADDON_ID }, ACTOR_ID, deps)).toEqual(
      err("El extra del catálogo no existe.")
    );
    expect(deps.saveSalonPlanOverride).not.toHaveBeenCalled();
    expect(deps.publishAuditEvent).not.toHaveBeenCalled();
  });

  it("rechaza un extra del catálogo que no está activo", async () => {
    deps.findCommercialAddonById.mockResolvedValueOnce(addon({ status: "archived" }));

    expect(await assignSalonAddonConfig(ADMIN_PROOF, { salonId: SALON_ID, addonId: ADDON_ID }, ACTOR_ID, deps)).toEqual(
      err("Este extra no está activo en el catálogo.")
    );
    expect(deps.saveSalonPlanOverride).not.toHaveBeenCalled();
  });

  it("asigna un extra de módulo copiando el módulo y marcándolo habilitado, cantidad 1", async () => {
    deps.findCommercialAddonById.mockResolvedValueOnce(addon());

    const result = await assignSalonAddonConfig(ADMIN_PROOF, { salonId: SALON_ID, addonId: ADDON_ID, quantity: 4, reason: "Prueba" }, ACTOR_ID, deps);

    expect(result).toEqual(ok(undefined));
    expect(deps.saveSalonPlanOverride).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({
        salonId: SALON_ID,
        moduleKey: "reports",
        metricKey: null,
        moduleEnabled: true,
        maxDelta: null,
        addonId: ADDON_ID,
        quantity: 1,
        isGift: false,
        priceOverride: null,
        reason: "Prueba",
        status: "active",
      })
    );
    expect(deps.publishAuditEvent).toHaveBeenCalledWith("billing.plan_extra_assigned",
      expect.objectContaining({ actorUserId: ACTOR_ID, action: "commercial_plan_extra_assigned", targetResourceId: SALON_ID })
    );
  });

  it("asigna un extra de límite con el incremento del catálogo y la cantidad pedida", async () => {
    deps.findCommercialAddonById.mockResolvedValueOnce(
      addon({ kind: "limit_boost", moduleKey: null, metricKey: "customers_active", limitDelta: 50, monthlyPrice: 4 })
    );

    await assignSalonAddonConfig(ADMIN_PROOF, { salonId: SALON_ID, addonId: ADDON_ID, quantity: 3, priceOverride: "2" }, ACTOR_ID, deps);

    expect(deps.saveSalonPlanOverride).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({
        moduleKey: null,
        metricKey: "customers_active",
        moduleEnabled: null,
        maxDelta: 50,
        quantity: 3,
        priceOverride: 2,
      })
    );
  });

  it("si el repositorio falla devuelve el mensaje de respaldo y no audita", async () => {
    deps.findCommercialAddonById.mockResolvedValueOnce(addon());
    deps.saveSalonPlanOverride.mockRejectedValueOnce(new Error("fk"));

    expect(await assignSalonAddonConfig(ADMIN_PROOF, { salonId: SALON_ID, addonId: ADDON_ID }, ACTOR_ID, deps)).toEqual(
      err("No se pudo asignar el extra.")
    );
    expect(deps.publishAuditEvent).not.toHaveBeenCalled();
  });
});

describe("saveSalonManualExtraConfig", () => {
  it("exige un módulo o un límite antes de escribir", async () => {
    expect(await saveSalonManualExtraConfig(ADMIN_PROOF, { salonId: SALON_ID, moduleKey: "", metricKey: "" }, ACTOR_ID, deps)).toEqual(
      err("Selecciona un módulo o un límite para el extra.")
    );
    expect(deps.saveSalonPlanOverride).not.toHaveBeenCalled();
  });

  it("guarda un módulo regalado habilitado por defecto y audita el override", async () => {
    const result = await saveSalonManualExtraConfig(ADMIN_PROOF, { salonId: SALON_ID, moduleKey: "reports" }, ACTOR_ID, deps);

    expect(result).toEqual(ok(undefined));
    expect(deps.saveSalonPlanOverride).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({
        salonId: SALON_ID,
        moduleKey: "reports",
        metricKey: null,
        moduleEnabled: true,
        maxDelta: null,
        maxOverride: null,
        isGift: true,
        addonId: null,
        quantity: 1,
        priceOverride: null,
      })
    );
    expect(deps.publishAuditEvent).toHaveBeenCalledWith("billing.plan_override_saved",
      expect.objectContaining({ actorUserId: ACTOR_ID, action: "commercial_plan_override_saved", targetResourceId: SALON_ID })
    );
  });

  it("un límite manual sin tope se guarda como null, no como 0, y no marca módulo", async () => {
    await saveSalonManualExtraConfig(ADMIN_PROOF, { salonId: SALON_ID, metricKey: "customers_active", maxDelta: "" }, ACTOR_ID, deps);

    expect(deps.saveSalonPlanOverride).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({ moduleKey: null, moduleEnabled: null, metricKey: "customers_active", maxDelta: null })
    );
  });

  it("si el repositorio falla devuelve el mensaje de respaldo y no audita", async () => {
    deps.saveSalonPlanOverride.mockRejectedValueOnce(new Error("boom"));

    expect(await saveSalonManualExtraConfig(ADMIN_PROOF, { salonId: SALON_ID, moduleKey: "reports" }, ACTOR_ID, deps)).toEqual(
      err("No se pudo guardar el extra.")
    );
    expect(deps.publishAuditEvent).not.toHaveBeenCalled();
  });
});

describe("cancelSalonExtraConfig", () => {
  it("cancela el override del salón y audita la cancelación", async () => {
    const result = await cancelSalonExtraConfig(ADMIN_PROOF, OVERRIDE_ID, SALON_ID, ACTOR_ID, deps);

    expect(result).toEqual(ok(undefined));
    expect(deps.updateSalonPlanOverrideStatus).toHaveBeenCalledWith(ADMIN_PROOF, SALON_ID, OVERRIDE_ID, "canceled");
    expect(deps.publishAuditEvent).toHaveBeenCalledWith("billing.plan_extra_canceled",
      expect.objectContaining({ actorUserId: ACTOR_ID, action: "commercial_plan_extra_canceled", targetResourceId: SALON_ID })
    );
  });

  it("si la actualización falla devuelve el mensaje de respaldo y no audita", async () => {
    deps.updateSalonPlanOverrideStatus.mockRejectedValueOnce(new Error("rls"));

    expect(await cancelSalonExtraConfig(ADMIN_PROOF, OVERRIDE_ID, SALON_ID, ACTOR_ID, deps)).toEqual(
      err("No se pudo cancelar el extra.")
    );
    expect(deps.publishAuditEvent).not.toHaveBeenCalled();
  });
});
