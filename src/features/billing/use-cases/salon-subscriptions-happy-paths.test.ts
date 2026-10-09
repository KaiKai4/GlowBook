import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activatePaidPeriod,
  assignSalonPlan,
  findAssignmentForPayment,
  findAssignmentStartsAt,
  recordSalonPlanPayment,
  saveSalonPlanOverride,
} from "../data/salon-subscriptions.repo";
import { findCommercialAddonById } from "../data/commercial-addons.repo";
import { findPlanWithChildren } from "../data/commercial-plans.repo";
import type { CommercialAddon } from "../domain/salon-extras";
import { publishAuditEvent } from "@/features/audit";
import { plan } from "@/test/billing-plan-fixtures";
import { err, ok } from "@/lib/result";
import {
  assignSalonAddonConfig,
  assignSalonCommercialPlanConfig,
  registerSalonPlanPaymentConfig,
  saveSalonManualExtraConfig,
} from "./salon-subscriptions";

// Caminos felices de los casos de uso de suscripción: validan la entrada,
// persisten con los datos derivados y auditan la acción.

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

const SALON_ID = "00000000-0000-4000-8000-0000000000c1";
const PLAN_ID = "00000000-0000-4000-8000-0000000000c2";
const ADDON_ID = "00000000-0000-4000-8000-0000000000c3";

function moduleAddon(overrides: Partial<CommercialAddon> = {}): CommercialAddon {
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

describe("asignar plan al salón", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza un plan que no existe en el catálogo sin asignar nada", async () => {
    vi.mocked(findPlanWithChildren).mockResolvedValue(null);
    vi.mocked(findAssignmentStartsAt).mockResolvedValue(null);

    expect(await assignSalonCommercialPlanConfig({ salonId: SALON_ID, planId: PLAN_ID })).toEqual(
      err("El plan seleccionado no existe.")
    );
    expect(assignSalonPlan).not.toHaveBeenCalled();
  });

  it("asigna el plan con fechas derivadas, conserva las notas y audita", async () => {
    vi.mocked(findPlanWithChildren).mockResolvedValue(plan({ trialDays: 0 }));
    vi.mocked(findAssignmentStartsAt).mockResolvedValue(null);

    const result = await assignSalonCommercialPlanConfig(
      { salonId: SALON_ID, planId: PLAN_ID, notes: "  Migrado desde Excel  " },
      "actor-1"
    );

    expect(result).toEqual(ok(undefined));
    expect(assignSalonPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: SALON_ID,
        planId: PLAN_ID,
        status: "trialing",
        notes: "Migrado desde Excel",
        endsAt: null,
      })
    );
    expect(publishAuditEvent).toHaveBeenCalledWith("billing.plan_assigned", expect.objectContaining({ actorUserId: "actor-1", action: "commercial_plan_assigned", targetResourceId: SALON_ID }));
  });
});

describe("registrar pago de mensualidad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza el pago de un salón que no tiene plan asignado", async () => {
    vi.mocked(findAssignmentForPayment).mockResolvedValue(null);

    expect(await registerSalonPlanPaymentConfig({ salonId: SALON_ID, amount: 25 })).toEqual(
      err("Este salon no tiene plan asignado. Asignale un plan primero.")
    );
    expect(recordSalonPlanPayment).not.toHaveBeenCalled();
    expect(activatePaidPeriod).not.toHaveBeenCalled();
  });

  it("registra el pago en la moneda del plan y activa el periodo pagado", async () => {
    vi.mocked(findAssignmentForPayment).mockResolvedValue({ plan_id: PLAN_ID, current_period_end: null });
    vi.mocked(findPlanWithChildren).mockResolvedValue(plan({ currency: "USD" }));

    const result = await registerSalonPlanPaymentConfig(
      { salonId: SALON_ID, amount: 25, paidAt: "2026-05-10", notes: "Transferencia" },
      "actor-1"
    );

    expect(result).toEqual(ok(undefined));
    expect(recordSalonPlanPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: SALON_ID,
        planId: PLAN_ID,
        amount: 25,
        currency: "USD",
        paidAt: "2026-05-10",
        notes: "Transferencia",
      })
    );
    expect(activatePaidPeriod).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: SALON_ID, periodStart: expect.any(String), periodEnd: expect.any(String) })
    );
    expect(publishAuditEvent).toHaveBeenCalledWith("billing.payment_registered", expect.objectContaining({ action: "commercial_plan_payment_recorded", targetResourceId: SALON_ID }));
  });
});

describe("extras comerciales del salón", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza un extra inexistente o inactivo sin guardar la sobreescritura", async () => {
    vi.mocked(findCommercialAddonById).mockResolvedValueOnce(null);
    expect(await assignSalonAddonConfig({ salonId: SALON_ID, addonId: ADDON_ID })).toEqual(
      err("El extra del catalogo no existe.")
    );

    vi.mocked(findCommercialAddonById).mockResolvedValueOnce(moduleAddon({ status: "archived" }));
    expect(await assignSalonAddonConfig({ salonId: SALON_ID, addonId: ADDON_ID })).toEqual(
      err("Este extra no esta activo en el catalogo.")
    );
    expect(saveSalonPlanOverride).not.toHaveBeenCalled();
  });

  it("asigna un extra de módulo habilitando el módulo y sin límite", async () => {
    vi.mocked(findCommercialAddonById).mockResolvedValue(moduleAddon());

    const result = await assignSalonAddonConfig({ salonId: SALON_ID, addonId: ADDON_ID, reason: "Compra web" });

    expect(result).toEqual(ok(undefined));
    expect(saveSalonPlanOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: SALON_ID,
        moduleKey: "reports",
        moduleEnabled: true,
        maxDelta: null,
        addonId: ADDON_ID,
        quantity: 1,
        reason: "Compra web",
        status: "active",
      })
    );
    expect(publishAuditEvent).toHaveBeenCalledWith("billing.plan_extra_assigned", expect.objectContaining({ action: "commercial_plan_extra_assigned", targetResourceId: SALON_ID }));
  });

  it("asigna un extra de límite con la cantidad solicitada", async () => {
    vi.mocked(findCommercialAddonById).mockResolvedValue(
      moduleAddon({ kind: "limit_boost", moduleKey: null, metricKey: "customers_active", limitDelta: 20 })
    );

    await assignSalonAddonConfig({ salonId: SALON_ID, addonId: ADDON_ID, quantity: 3 });

    expect(saveSalonPlanOverride).toHaveBeenCalledWith(
      expect.objectContaining({ moduleEnabled: null, maxDelta: 20, metricKey: "customers_active", quantity: 3 })
    );
  });

  it("exige un módulo o un límite al guardar un extra manual", async () => {
    expect(await saveSalonManualExtraConfig({ salonId: SALON_ID })).toEqual(
      err("Selecciona un modulo o un límite para el extra.")
    );
    expect(saveSalonPlanOverride).not.toHaveBeenCalled();
  });

  it("guarda un extra manual de módulo habilitado por defecto", async () => {
    const result = await saveSalonManualExtraConfig({
      salonId: SALON_ID,
      moduleKey: "reports",
      reason: "Cortesía",
    });

    expect(result).toEqual(ok(undefined));
    expect(saveSalonPlanOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: SALON_ID,
        moduleKey: "reports",
        metricKey: null,
        moduleEnabled: true,
        reason: "Cortesía",
        isGift: true,
      })
    );
  });
});
