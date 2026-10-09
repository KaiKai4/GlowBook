import { beforeEach, describe, expect, it, vi } from "vitest";
import { assignSalonAddonConfig, assignSalonCommercialPlanConfig, registerSalonPlanPaymentConfig, saveSalonManualExtraConfig } from "./salon-subscriptions";
import { assignSalonPlan, recordSalonPlanPayment, saveSalonPlanOverride } from "../data/salon-subscriptions.repo";
import { err } from "@/lib/result";

// Validación de entrada de suscripciones: los rechazos deben ocurrir antes de
// cualquier escritura en la base de datos.

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

const SALON_ID = "00000000-0000-4000-8000-0000000000b1";
const PLAN_ID = "00000000-0000-4000-8000-0000000000b2";

describe("suscripciones de salón: validación de entrada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asignar plan exige salón y plan válidos sin escribir", async () => {
    expect(await assignSalonCommercialPlanConfig({ salonId: "x", planId: PLAN_ID })).toEqual(
      err("Selecciona un salon.")
    );
    expect(await assignSalonCommercialPlanConfig({ salonId: SALON_ID, planId: "x" })).toEqual(
      err("Selecciona un plan.")
    );
    expect(assignSalonPlan).not.toHaveBeenCalled();
  });

  it("registrar un pago rechaza montos negativos sin escribir", async () => {
    expect(await registerSalonPlanPaymentConfig({ salonId: SALON_ID, amount: -5 })).toEqual(
      err("El monto no puede ser negativo.")
    );
    expect(recordSalonPlanPayment).not.toHaveBeenCalled();
  });

  it("asignar un extra exige un extra válido del catálogo", async () => {
    expect(await assignSalonAddonConfig({ salonId: SALON_ID, addonId: "x" })).toEqual(
      err("Selecciona un extra del catalogo.")
    );
    expect(saveSalonPlanOverride).not.toHaveBeenCalled();
  });

  it("el extra manual exige un salón válido antes de calcular overrides", async () => {
    expect(await saveSalonManualExtraConfig({ salonId: "x" })).toEqual(err("Selecciona un salon."));
    expect(saveSalonPlanOverride).not.toHaveBeenCalled();
  });
});
