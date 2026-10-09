import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activatePaidPeriod,
  assignSalonPlan,
  findAssignmentForPayment,
  findAssignmentStartsAt,
  recordPlanAlert,
  recordSalonPlanPayment,
  resolvePlanAlert,
  saveSalonPlanOverride,
  updateSalonPlanOverrideStatus,
} from "../data/salon-subscriptions.repo";
import { findCommercialAddonById } from "../data/commercial-addons.repo";
import { findPlanWithChildren } from "../data/commercial-plans.repo";
import type { CommercialAddon } from "../domain/salon-extras";
import { recordPlatformAction } from "@/features/platform/use-cases/platform-audit";
import { plan } from "@/test/billing-plan-fixtures";
import { err, ok } from "@/lib/result";
import {
  assignSalonAddonConfig,
  assignSalonCommercialPlanConfig,
  autoAssignPlanOnAcceptance,
  cancelSalonExtraConfig,
  registerSalonPlanPaymentConfig,
  resolveSalonPlanAlertConfig,
  saveSalonManualExtraConfig,
} from "./salon-subscriptions";

// Mutaciones de suscripciones: cada caso de uso valida, deriva fechas y datos
// por salón, persiste y audita. Los rechazos no deben escribir nada.

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

const SALON_ID = "00000000-0000-4000-8000-0000000000e1";
const PLAN_ID = "00000000-0000-4000-8000-0000000000e2";
const ADDON_ID = "00000000-0000-4000-8000-0000000000e3";
const ACTOR_ID = "00000000-0000-4000-8000-0000000000e4";
const NOW = "2026-10-09T12:00:00.000Z";

const saveOverrideMock = vi.mocked(saveSalonPlanOverride);
const assignPlanMock = vi.mocked(assignSalonPlan);
const startsAtMock = vi.mocked(findAssignmentStartsAt);
const findPlanMock = vi.mocked(findPlanWithChildren);
const findAddonMock = vi.mocked(findCommercialAddonById);
const findAssignmentPaymentMock = vi.mocked(findAssignmentForPayment);
const recordPaymentMock = vi.mocked(recordSalonPlanPayment);
const activatePeriodMock = vi.mocked(activatePaidPeriod);
const resolveAlertMock = vi.mocked(resolvePlanAlert);
const updateOverrideStatusMock = vi.mocked(updateSalonPlanOverrideStatus);
const auditMock = vi.mocked(recordPlatformAction);
const recordAlertMock = vi.mocked(recordPlanAlert);

function addon(overrides: Partial<CommercialAddon> = {}): CommercialAddon {
  return {
    id: ADDON_ID,
    code: "clientes",
    name: "Bloque de clientes",
    description: "",
    kind: "limit_boost",
    moduleKey: null,
    metricKey: "customers_active",
    limitDelta: 50,
    currency: "USD",
    monthlyPrice: 8,
    status: "active",
    sortOrder: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  assignPlanMock.mockResolvedValue(undefined);
  startsAtMock.mockResolvedValue(null);
  findPlanMock.mockResolvedValue(null);
  findAddonMock.mockResolvedValue(null);
  findAssignmentPaymentMock.mockResolvedValue(null);
  recordPaymentMock.mockResolvedValue(undefined);
  activatePeriodMock.mockResolvedValue(undefined);
  resolveAlertMock.mockResolvedValue(undefined);
  updateOverrideStatusMock.mockResolvedValue(undefined);
  saveOverrideMock.mockResolvedValue(undefined);
  recordAlertMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resolveSalonPlanAlertConfig", () => {
  it("marca la alerta como resuelta y audita con el salón como objetivo", async () => {
    const result = await resolveSalonPlanAlertConfig("alert-1", SALON_ID, ACTOR_ID);

    expect(result).toEqual(ok(undefined));
    expect(resolveAlertMock).toHaveBeenCalledWith("alert-1");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: ACTOR_ID,
        action: "commercial_plan_alert_resolved",
        targetResourceId: SALON_ID,
      })
    );
  });

  it("devuelve el prefijo de error propio si la escritura falla, sin auditar", async () => {
    resolveAlertMock.mockRejectedValueOnce(new Error("alerta bloqueada"));

    const result = await resolveSalonPlanAlertConfig("alert-1", SALON_ID);

    expect(result.ok).toBe(false);
    expect(result).toEqual(err(expect.stringContaining("No se pudo resolver la alerta.")));
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("autoAssignPlanOnAcceptance", () => {
  it("rechaza la invitación si el plan ya no existe, sin asignar nada", async () => {
    findPlanMock.mockResolvedValueOnce(null);

    const result = await autoAssignPlanOnAcceptance({
      salonId: SALON_ID,
      planId: PLAN_ID,
      acceptedByUserId: ACTOR_ID,
    });

    expect(result).toEqual(err("El plan de la invitacion ya no existe."));
    expect(assignPlanMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("nace en prueba con fin de trial cuando el plan ofrece días de prueba", async () => {
    findPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID, trialDays: 14 }));

    const result = await autoAssignPlanOnAcceptance({
      salonId: SALON_ID,
      planId: PLAN_ID,
      acceptedByUserId: ACTOR_ID,
    });

    expect(result).toEqual(ok(undefined));
    expect(assignPlanMock).toHaveBeenCalledWith({
      salonId: SALON_ID,
      planId: PLAN_ID,
      status: "trialing",
      startsAt: "2026-10-09",
      endsAt: null,
      trialEndsAt: "2026-10-23",
      notes: "Asignado automaticamente al aceptar la invitacion.",
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: ACTOR_ID,
        action: "commercial_plan_assigned",
        targetResourceId: SALON_ID,
      })
    );
  });

  it("nace activo y sin fecha de trial cuando el plan no tiene días de prueba", async () => {
    findPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID, trialDays: 0 }));

    await autoAssignPlanOnAcceptance({ salonId: SALON_ID, planId: PLAN_ID, acceptedByUserId: ACTOR_ID });

    expect(assignPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", startsAt: "2026-10-09", trialEndsAt: null })
    );
  });

  it("devuelve el prefijo propio cuando la asignación falla", async () => {
    findPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID }));
    assignPlanMock.mockRejectedValueOnce(new Error("upsert rechazado"));

    const result = await autoAssignPlanOnAcceptance({
      salonId: SALON_ID,
      planId: PLAN_ID,
      acceptedByUserId: ACTOR_ID,
    });

    expect(result).toEqual(err(expect.stringContaining("No se pudo asignar el plan de la invitacion.")));
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("cancelSalonExtraConfig", () => {
  it("cancela la sobreescritura por id y audita la cancelación del extra del salón", async () => {
    const result = await cancelSalonExtraConfig("ov-1", SALON_ID, ACTOR_ID);

    expect(result).toEqual(ok(undefined));
    expect(updateOverrideStatusMock).toHaveBeenCalledWith("ov-1", "canceled");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "commercial_plan_extra_canceled",
        targetResourceId: SALON_ID,
        actorUserId: ACTOR_ID,
      })
    );
  });

  it("devuelve el prefijo propio cuando la cancelación falla", async () => {
    updateOverrideStatusMock.mockRejectedValueOnce(new Error("bloqueado"));

    const result = await cancelSalonExtraConfig("ov-1", SALON_ID);

    expect(result).toEqual(err(expect.stringContaining("No se pudo cancelar el extra.")));
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("assignSalonCommercialPlanConfig", () => {
  it("rechaza un salón inválido antes de consultar el plan", async () => {
    const result = await assignSalonCommercialPlanConfig({ salonId: "no-uuid", planId: PLAN_ID });

    expect(result).toEqual(err("Selecciona un salon."));
    expect(findPlanMock).not.toHaveBeenCalled();
    expect(assignPlanMock).not.toHaveBeenCalled();
  });

  it("rechaza un plan que ya no existe en el catálogo", async () => {
    findPlanMock.mockResolvedValueOnce(null);

    const result = await assignSalonCommercialPlanConfig({ salonId: SALON_ID, planId: PLAN_ID });

    expect(result).toEqual(err("El plan seleccionado no existe."));
    expect(assignPlanMock).not.toHaveBeenCalled();
  });

  it("conserva el inicio existente, usa el estado por defecto y aplica el fin manual", async () => {
    findPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID, trialDays: 7 }));
    startsAtMock.mockResolvedValueOnce("2026-02-01");

    const result = await assignSalonCommercialPlanConfig(
      { salonId: SALON_ID, planId: PLAN_ID, endsAt: "2026-12-31", notes: "  Renovación  " },
      ACTOR_ID
    );

    expect(result).toEqual(ok(undefined));
    expect(assignPlanMock).toHaveBeenCalledWith({
      salonId: SALON_ID,
      planId: PLAN_ID,
      status: "trialing",
      startsAt: "2026-02-01",
      endsAt: "2026-12-31",
      trialEndsAt: "2026-02-08",
      notes: "Renovación",
    });
  });

  it("no pone fin programado cuando la fecha llega vacía o en blanco", async () => {
    findPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID, trialDays: 0 }));

    await assignSalonCommercialPlanConfig({ salonId: SALON_ID, planId: PLAN_ID, status: "active", endsAt: "   " });

    expect(assignPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", endsAt: null, startsAt: "2026-10-09", trialEndsAt: null })
    );
  });

  it("devuelve el prefijo propio cuando la escritura falla", async () => {
    findPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID }));
    assignPlanMock.mockRejectedValueOnce(new Error("upsert rechazado"));

    const result = await assignSalonCommercialPlanConfig({ salonId: SALON_ID, planId: PLAN_ID });

    expect(result).toEqual(err(expect.stringContaining("No se pudo asignar el plan.")));
  });
});

describe("registerSalonPlanPaymentConfig", () => {
  it("rechaza un monto negativo y una fecha con formato inválido sin escribir", async () => {
    const negative = await registerSalonPlanPaymentConfig({ salonId: SALON_ID, amount: -5 });
    expect(negative).toEqual(err("El monto no puede ser negativo."));

    const badDate = await registerSalonPlanPaymentConfig({ salonId: SALON_ID, amount: 5, paidAt: "09/10/2026" });
    expect(badDate).toEqual(err("Fecha de pago inválida."));

    expect(findAssignmentPaymentMock).not.toHaveBeenCalled();
    expect(recordPaymentMock).not.toHaveBeenCalled();
  });

  it("rechaza el pago cuando el salón no tiene plan asignado", async () => {
    findAssignmentPaymentMock.mockResolvedValueOnce(null);

    const result = await registerSalonPlanPaymentConfig({ salonId: SALON_ID, amount: 20 });

    expect(result).toEqual(err("Este salon no tiene plan asignado. Asignale un plan primero."));
    expect(recordPaymentMock).not.toHaveBeenCalled();
    expect(activatePeriodMock).not.toHaveBeenCalled();
  });

  it("usa la fecha de hoy y la moneda USD cuando el plan ya no existe en el catálogo", async () => {
    findAssignmentPaymentMock.mockResolvedValueOnce({ plan_id: PLAN_ID, current_period_end: null });
    findPlanMock.mockResolvedValueOnce(null);

    const result = await registerSalonPlanPaymentConfig({ salonId: SALON_ID, amount: 20, notes: "Efectivo" }, ACTOR_ID);

    expect(result).toEqual(ok(undefined));
    expect(recordPaymentMock).toHaveBeenCalledWith({
      salonId: SALON_ID,
      planId: PLAN_ID,
      amount: 20,
      currency: "USD",
      paidAt: "2026-10-09",
      periodStart: "2026-10-09",
      periodEnd: "2026-11-09",
      notes: "Efectivo",
    });
    expect(activatePeriodMock).toHaveBeenCalledWith({
      salonId: SALON_ID,
      periodStart: "2026-10-09",
      periodEnd: "2026-11-09",
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "commercial_plan_payment_recorded", targetResourceId: SALON_ID })
    );
  });

  it("encadena el nuevo mes al periodo vigente cuando el pago llega por adelantado", async () => {
    findAssignmentPaymentMock.mockResolvedValueOnce({ plan_id: PLAN_ID, current_period_end: "2026-11-05" });
    findPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID, currency: "EUR" }));

    await registerSalonPlanPaymentConfig({ salonId: SALON_ID, amount: 20, paidAt: "2026-10-20" });

    expect(recordPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: "EUR",
        paidAt: "2026-10-20",
        periodStart: "2026-11-05",
        periodEnd: "2026-12-05",
      })
    );
    expect(activatePeriodMock).toHaveBeenCalledWith(
      expect.objectContaining({ periodStart: "2026-11-05", periodEnd: "2026-12-05" })
    );
  });

  it("devuelve el prefijo propio cuando el registro del pago falla", async () => {
    findAssignmentPaymentMock.mockResolvedValueOnce({ plan_id: PLAN_ID, current_period_end: null });
    recordPaymentMock.mockRejectedValueOnce(new Error("insert rechazado"));

    const result = await registerSalonPlanPaymentConfig({ salonId: SALON_ID, amount: 20 });

    expect(result).toEqual(err(expect.stringContaining("No se pudo registrar el pago.")));
    expect(activatePeriodMock).not.toHaveBeenCalled();
  });
});

describe("assignSalonAddonConfig", () => {
  it("rechaza un extra inexistente sin sobreescribir al salón", async () => {
    const result = await assignSalonAddonConfig({ salonId: SALON_ID, addonId: ADDON_ID });

    expect(result).toEqual(err("El extra del catalogo no existe."));
    expect(saveOverrideMock).not.toHaveBeenCalled();
  });

  it("rechaza un extra que está en borrador o archivado en el catálogo", async () => {
    findAddonMock.mockResolvedValueOnce(addon({ status: "draft" }));

    const result = await assignSalonAddonConfig({ salonId: SALON_ID, addonId: ADDON_ID });

    expect(result).toEqual(err("Este extra no esta activo en el catalogo."));
    expect(saveOverrideMock).not.toHaveBeenCalled();
  });

  it("asigna un extra de límite con su incremento y la cantidad pedida", async () => {
    findAddonMock.mockResolvedValueOnce(addon());

    const result = await assignSalonAddonConfig(
      {
        salonId: SALON_ID,
        addonId: ADDON_ID,
        quantity: 3,
        isGift: false,
        priceOverride: "5.5",
        reason: "Campaña",
        startsAt: "2026-10-01",
        endsAt: "",
      },
      ACTOR_ID
    );

    expect(result).toEqual(ok(undefined));
    expect(saveOverrideMock).toHaveBeenCalledWith({
      salonId: SALON_ID,
      moduleKey: null,
      metricKey: "customers_active",
      moduleEnabled: null,
      maxDelta: 50,
      maxOverride: null,
      enforcementMode: null,
      warningThreshold: null,
      reason: "Campaña",
      startsAt: "2026-10-01",
      endsAt: null,
      status: "active",
      addonId: ADDON_ID,
      quantity: 3,
      isGift: false,
      priceOverride: 5.5,
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "commercial_plan_extra_assigned", actorUserId: ACTOR_ID })
    );
  });

  it("CONDUCTA ACTUAL (posible bug): un precio especial vacío se guarda como 0 en lugar de usar el precio de catálogo", async () => {
    // AddonExtraSchema.priceOverride: coerce.number() antes que literal(""), así que "" => 0.
    // Como extraMonthlyPrice usa ?? sobre priceOverride, 0 anula el precio de catálogo.
    findAddonMock.mockResolvedValueOnce(addon({ monthlyPrice: 8 }));

    await assignSalonAddonConfig({ salonId: SALON_ID, addonId: ADDON_ID, priceOverride: "" });

    expect(saveOverrideMock).toHaveBeenCalledWith(expect.objectContaining({ priceOverride: 0 }));
  });

  it("asigna un extra de módulo habilitado y fuerza cantidad uno aunque se pida otra", async () => {
    findAddonMock.mockResolvedValueOnce(
      addon({ kind: "module", moduleKey: "reports", metricKey: null, limitDelta: null, monthlyPrice: 12 })
    );

    await assignSalonAddonConfig({ salonId: SALON_ID, addonId: ADDON_ID, quantity: 9 });

    expect(saveOverrideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleKey: "reports",
        moduleEnabled: true,
        maxDelta: null,
        quantity: 1,
        isGift: false,
        priceOverride: null,
      })
    );
  });

  it("rechaza un identificador de extra que no es uuid", async () => {
    const result = await assignSalonAddonConfig({ salonId: SALON_ID, addonId: "extra-x" });

    expect(result).toEqual(err("Selecciona un extra del catalogo."));
    expect(findAddonMock).not.toHaveBeenCalled();
  });

  it("devuelve el prefijo propio cuando la escritura falla", async () => {
    findAddonMock.mockResolvedValueOnce(addon());
    saveOverrideMock.mockRejectedValueOnce(new Error("constraint"));

    const result = await assignSalonAddonConfig({ salonId: SALON_ID, addonId: ADDON_ID });

    expect(result).toEqual(err(expect.stringContaining("No se pudo asignar el extra.")));
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("saveSalonManualExtraConfig", () => {
  it("exige un módulo o un límite antes de tocar la base", async () => {
    const result = await saveSalonManualExtraConfig({ salonId: SALON_ID });

    expect(result).toEqual(err("Selecciona un modulo o un límite para el extra."));
    expect(saveOverrideMock).not.toHaveBeenCalled();
  });

  it("para un extra de límite deja el módulo vacío y no fija habilitación", async () => {
    const result = await saveSalonManualExtraConfig({
      salonId: SALON_ID,
      metricKey: "employees_active",
      moduleEnabled: false,
      maxDelta: "3",
      isGift: false,
    });

    expect(result).toEqual(ok(undefined));
    expect(saveOverrideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleKey: null,
        metricKey: "employees_active",
        moduleEnabled: null,
        maxDelta: 3,
        maxOverride: null,
        isGift: false,
        addonId: null,
        quantity: 1,
        priceOverride: null,
      })
    );
  });

  it("CONDUCTA ACTUAL (posible bug): un tope fijo vacío se guarda como 0 y no como sin tope", async () => {
    // ManualExtraSchema: la unión coerce.number() va antes que literal(""), así que
    // "" se convierte en 0 y el transform que devolvería null nunca se ejecuta
    // (src/features/billing/use-cases/salon-subscriptions.ts, ManualExtraSchema.maxOverride).
    await saveSalonManualExtraConfig({ salonId: SALON_ID, metricKey: "employees_active", maxOverride: "" });

    expect(saveOverrideMock).toHaveBeenCalledWith(expect.objectContaining({ maxOverride: 0 }));
  });

  it("por defecto el extra manual es un regalo y un módulo sin decisión queda habilitado", async () => {
    await saveSalonManualExtraConfig({ salonId: SALON_ID, moduleKey: "reports" }, ACTOR_ID);

    expect(saveOverrideMock).toHaveBeenCalledWith(
      expect.objectContaining({ moduleKey: "reports", moduleEnabled: true, isGift: true })
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "commercial_plan_override_saved", actorUserId: ACTOR_ID })
    );
  });

  it("respeta la desactivación explícita de un módulo", async () => {
    await saveSalonManualExtraConfig({ salonId: SALON_ID, moduleKey: "reports", moduleEnabled: false });

    expect(saveOverrideMock).toHaveBeenCalledWith(
      expect.objectContaining({ moduleKey: "reports", moduleEnabled: false })
    );
  });

  it("devuelve el prefijo propio cuando la escritura falla", async () => {
    saveOverrideMock.mockRejectedValueOnce(new Error("constraint"));

    const result = await saveSalonManualExtraConfig({ salonId: SALON_ID, metricKey: "employees_active" });

    expect(result).toEqual(err(expect.stringContaining("No se pudo guardar el extra.")));
  });
});
