import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activatePaidPeriod,
  assignSalonPlan,
  assignSalonPlanAtAcceptance,
  findAssignmentForPayment,
  findAssignmentStartsAt,
  recordPlanAlert,
  recordSalonPlanPayment,
  resolvePlanAlert,
  saveSalonPlanOverride,
  updateSalonPlanOverrideStatus,
} from "../data/salon-subscriptions.repo";
import { findCommercialAddonById } from "../data/commercial-addons.repo";
import { findPlanWithChildren, findPlanWithChildrenAtAcceptance } from "../data/commercial-plans.repo";
import type { CommercialAddon } from "../domain/salon-extras";
import { publishAuditEvent } from "@/features/audit";
import { plan } from "@/test/billing-plan-fixtures";
import { err, ok } from "@/infra/result";
import { assignSalonAddonConfig, cancelSalonExtraConfig, saveSalonManualExtraConfig } from "./salon-plan-extras";
import { assignSalonCommercialPlanConfig, autoAssignPlanOnAcceptance, registerSalonPlanPaymentConfig } from "./salon-plan-assignment";
import { resolveSalonPlanAlertConfig } from "./plan-limits";
import { issuePlatformAdminProof } from "@/infra/auth/platform-admin-proof";
const ADMIN_PROOF = issuePlatformAdminProof("admin-1");

// Mutaciones de suscripciones: cada caso de uso valida, deriva fechas y datos
// por salón, persiste y audita. Los rechazos no deben escribir nada.

vi.mock("../data/salon-subscriptions.repo", () => ({
  activatePaidPeriod: vi.fn(),
  assignSalonPlan: vi.fn(),
  assignSalonPlanAtAcceptance: vi.fn(),
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
  findPlanWithChildrenAtAcceptance: vi.fn(),
}));
vi.mock("@/features/audit", () => ({
  publishAuditEvent: vi.fn(async () => []),
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
const findAcceptPlanMock = vi.mocked(findPlanWithChildrenAtAcceptance);
const assignAcceptMock = vi.mocked(assignSalonPlanAtAcceptance);
const findAddonMock = vi.mocked(findCommercialAddonById);
const findAssignmentPaymentMock = vi.mocked(findAssignmentForPayment);
const recordPaymentMock = vi.mocked(recordSalonPlanPayment);
const activatePeriodMock = vi.mocked(activatePaidPeriod);
const resolveAlertMock = vi.mocked(resolvePlanAlert);
const updateOverrideStatusMock = vi.mocked(updateSalonPlanOverrideStatus);
const auditMock = vi.mocked(publishAuditEvent);
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
  findAcceptPlanMock.mockResolvedValue(null);
  assignAcceptMock.mockResolvedValue(undefined);
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
    const result = await resolveSalonPlanAlertConfig(ADMIN_PROOF, "alert-1", SALON_ID, ACTOR_ID);

    expect(result).toEqual(ok(undefined));
    expect(resolveAlertMock).toHaveBeenCalledWith(ADMIN_PROOF, SALON_ID, "alert-1");
    expect(auditMock).toHaveBeenCalledWith("billing.plan_alert_resolved", 
      expect.objectContaining({
        actorUserId: ACTOR_ID,
        action: "commercial_plan_alert_resolved",
        targetResourceId: SALON_ID,
      })
    );
  });

  it("devuelve el prefijo de error propio si la escritura falla, sin auditar", async () => {
    resolveAlertMock.mockRejectedValueOnce(new Error("alerta bloqueada"));

    const result = await resolveSalonPlanAlertConfig(ADMIN_PROOF, "alert-1", SALON_ID);

    expect(result.ok).toBe(false);
    expect(result).toEqual(err(expect.stringContaining("No se pudo resolver la alerta.")));
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("autoAssignPlanOnAcceptance", () => {
  it("rechaza la invitación si el plan ya no existe, sin asignar nada", async () => {
    findAcceptPlanMock.mockResolvedValueOnce(null);

    const result = await autoAssignPlanOnAcceptance({
      salonId: SALON_ID,
      planId: PLAN_ID,
      acceptedByUserId: ACTOR_ID,
    });

    expect(result).toEqual(err("El plan de la invitación ya no existe."));
    expect(assignAcceptMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("nace en prueba con fin de trial cuando el plan ofrece días de prueba", async () => {
    findAcceptPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID, trialDays: 14 }));

    const result = await autoAssignPlanOnAcceptance({
      salonId: SALON_ID,
      planId: PLAN_ID,
      acceptedByUserId: ACTOR_ID,
    });

    expect(result).toEqual(ok(undefined));
    expect(assignAcceptMock).toHaveBeenCalledWith({
      salonId: SALON_ID,
      planId: PLAN_ID,
      status: "trialing",
      startsAt: "2026-10-09",
      endsAt: null,
      trialEndsAt: "2026-10-23",
      notes: "Asignado automaticamente al aceptar la invitación.",
    });
    expect(auditMock).toHaveBeenCalledWith("billing.plan_assigned", 
      expect.objectContaining({
        actorUserId: ACTOR_ID,
        action: "commercial_plan_assigned",
        targetResourceId: SALON_ID,
      })
    );
  });

  it("nace activo y sin fecha de trial cuando el plan no tiene días de prueba", async () => {
    findAcceptPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID, trialDays: 0 }));

    await autoAssignPlanOnAcceptance({ salonId: SALON_ID, planId: PLAN_ID, acceptedByUserId: ACTOR_ID });

    expect(assignAcceptMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", startsAt: "2026-10-09", trialEndsAt: null })
    );
  });

  it("devuelve el prefijo propio cuando la asignación falla", async () => {
    findAcceptPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID }));
    assignAcceptMock.mockRejectedValueOnce(new Error("upsert rechazado"));

    const result = await autoAssignPlanOnAcceptance({
      salonId: SALON_ID,
      planId: PLAN_ID,
      acceptedByUserId: ACTOR_ID,
    });

    expect(result).toEqual(err(expect.stringContaining("No se pudo asignar el plan de la invitación.")));
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("cancelSalonExtraConfig", () => {
  it("cancela la sobreescritura por id y audita la cancelación del extra del salón", async () => {
    const result = await cancelSalonExtraConfig(ADMIN_PROOF, "ov-1", SALON_ID, ACTOR_ID);

    expect(result).toEqual(ok(undefined));
    expect(updateOverrideStatusMock).toHaveBeenCalledWith(ADMIN_PROOF, SALON_ID, "ov-1", "canceled");
    expect(auditMock).toHaveBeenCalledWith("billing.plan_extra_canceled", 
      expect.objectContaining({
        action: "commercial_plan_extra_canceled",
        targetResourceId: SALON_ID,
        actorUserId: ACTOR_ID,
      })
    );
  });

  it("devuelve el prefijo propio cuando la cancelación falla", async () => {
    updateOverrideStatusMock.mockRejectedValueOnce(new Error("bloqueado"));

    const result = await cancelSalonExtraConfig(ADMIN_PROOF, "ov-1", SALON_ID);

    expect(result).toEqual(err(expect.stringContaining("No se pudo cancelar el extra.")));
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("assignSalonCommercialPlanConfig", () => {
  it("rechaza un salón inválido antes de consultar el plan", async () => {
    const result = await assignSalonCommercialPlanConfig(ADMIN_PROOF, { salonId: "no-uuid", planId: PLAN_ID });

    expect(result).toEqual(err("Selecciona un salón."));
    expect(findPlanMock).not.toHaveBeenCalled();
    expect(assignPlanMock).not.toHaveBeenCalled();
  });

  it("rechaza un plan que ya no existe en el catálogo", async () => {
    findPlanMock.mockResolvedValueOnce(null);

    const result = await assignSalonCommercialPlanConfig(ADMIN_PROOF, { salonId: SALON_ID, planId: PLAN_ID });

    expect(result).toEqual(err("El plan seleccionado no existe."));
    expect(assignPlanMock).not.toHaveBeenCalled();
  });

  it("conserva el inicio existente, usa el estado por defecto y aplica el fin manual", async () => {
    findPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID, trialDays: 7 }));
    startsAtMock.mockResolvedValueOnce("2026-02-01");

    const result = await assignSalonCommercialPlanConfig(ADMIN_PROOF, 
      { salonId: SALON_ID, planId: PLAN_ID, endsAt: "2026-12-31", notes: "  Renovación  " },
      ACTOR_ID
    );

    expect(result).toEqual(ok(undefined));
    expect(assignPlanMock).toHaveBeenCalledWith(ADMIN_PROOF, {
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

    await assignSalonCommercialPlanConfig(ADMIN_PROOF, { salonId: SALON_ID, planId: PLAN_ID, status: "active", endsAt: "   " });

    expect(assignPlanMock).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({ status: "active", endsAt: null, startsAt: "2026-10-09", trialEndsAt: null })
    );
  });

  it("devuelve el prefijo propio cuando la escritura falla", async () => {
    findPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID }));
    assignPlanMock.mockRejectedValueOnce(new Error("upsert rechazado"));

    const result = await assignSalonCommercialPlanConfig(ADMIN_PROOF, { salonId: SALON_ID, planId: PLAN_ID });

    expect(result).toEqual(err(expect.stringContaining("No se pudo asignar el plan.")));
  });
});

describe("registerSalonPlanPaymentConfig", () => {
  it("rechaza un monto negativo y una fecha con formato inválido sin escribir", async () => {
    const negative = await registerSalonPlanPaymentConfig(ADMIN_PROOF, { salonId: SALON_ID, amount: -5 });
    expect(negative).toEqual(err("El monto no puede ser negativo."));

    const badDate = await registerSalonPlanPaymentConfig(ADMIN_PROOF, { salonId: SALON_ID, amount: 5, paidAt: "09/10/2026" });
    expect(badDate).toEqual(err("Fecha de pago inválida."));

    expect(findAssignmentPaymentMock).not.toHaveBeenCalled();
    expect(recordPaymentMock).not.toHaveBeenCalled();
  });

  it("rechaza el pago cuando el salón no tiene plan asignado", async () => {
    findAssignmentPaymentMock.mockResolvedValueOnce(null);

    const result = await registerSalonPlanPaymentConfig(ADMIN_PROOF, { salonId: SALON_ID, amount: 20 });

    expect(result).toEqual(err("Este salón no tiene plan asignado. Asígnale un plan primero."));
    expect(recordPaymentMock).not.toHaveBeenCalled();
    expect(activatePeriodMock).not.toHaveBeenCalled();
  });

  it("usa la fecha de hoy y la moneda USD cuando el plan ya no existe en el catálogo", async () => {
    findAssignmentPaymentMock.mockResolvedValueOnce({ plan_id: PLAN_ID, current_period_end: null });
    findPlanMock.mockResolvedValueOnce(null);

    const result = await registerSalonPlanPaymentConfig(ADMIN_PROOF, { salonId: SALON_ID, amount: 20, notes: "Efectivo" }, ACTOR_ID);

    expect(result).toEqual(ok(undefined));
    expect(recordPaymentMock).toHaveBeenCalledWith(ADMIN_PROOF, {
      salonId: SALON_ID,
      planId: PLAN_ID,
      amount: 20,
      currency: "USD",
      paidAt: "2026-10-09",
      periodStart: "2026-10-09",
      periodEnd: "2026-11-09",
      notes: "Efectivo",
    });
    expect(activatePeriodMock).toHaveBeenCalledWith(ADMIN_PROOF, {
      salonId: SALON_ID,
      periodStart: "2026-10-09",
      periodEnd: "2026-11-09",
    });
    expect(auditMock).toHaveBeenCalledWith("billing.payment_registered", 
      expect.objectContaining({ action: "commercial_plan_payment_recorded", targetResourceId: SALON_ID })
    );
  });

  it("encadena el nuevo mes al período vigente cuando el pago llega por adelantado", async () => {
    findAssignmentPaymentMock.mockResolvedValueOnce({ plan_id: PLAN_ID, current_period_end: "2026-11-05" });
    findPlanMock.mockResolvedValueOnce(plan({ id: PLAN_ID, currency: "EUR" }));

    await registerSalonPlanPaymentConfig(ADMIN_PROOF, { salonId: SALON_ID, amount: 20, paidAt: "2026-10-20" });

    expect(recordPaymentMock).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({
        currency: "EUR",
        paidAt: "2026-10-20",
        periodStart: "2026-11-05",
        periodEnd: "2026-12-05",
      })
    );
    expect(activatePeriodMock).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({ periodStart: "2026-11-05", periodEnd: "2026-12-05" })
    );
  });

  it("devuelve el prefijo propio cuando el registro del pago falla", async () => {
    findAssignmentPaymentMock.mockResolvedValueOnce({ plan_id: PLAN_ID, current_period_end: null });
    recordPaymentMock.mockRejectedValueOnce(new Error("insert rechazado"));

    const result = await registerSalonPlanPaymentConfig(ADMIN_PROOF, { salonId: SALON_ID, amount: 20 });

    expect(result).toEqual(err(expect.stringContaining("No se pudo registrar el pago.")));
    expect(activatePeriodMock).not.toHaveBeenCalled();
  });
});

describe("assignSalonAddonConfig", () => {
  it("rechaza un extra inexistente sin sobreescribir al salón", async () => {
    const result = await assignSalonAddonConfig(ADMIN_PROOF, { salonId: SALON_ID, addonId: ADDON_ID });

    expect(result).toEqual(err("El extra del catálogo no existe."));
    expect(saveOverrideMock).not.toHaveBeenCalled();
  });

  it("rechaza un extra que está en borrador o archivado en el catálogo", async () => {
    findAddonMock.mockResolvedValueOnce(addon({ status: "draft" }));

    const result = await assignSalonAddonConfig(ADMIN_PROOF, { salonId: SALON_ID, addonId: ADDON_ID });

    expect(result).toEqual(err("Este extra no está activo en el catálogo."));
    expect(saveOverrideMock).not.toHaveBeenCalled();
  });

  it("asigna un extra de límite con su incremento y la cantidad pedida", async () => {
    findAddonMock.mockResolvedValueOnce(addon());

    const result = await assignSalonAddonConfig(ADMIN_PROOF, 
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
    expect(saveOverrideMock).toHaveBeenCalledWith(ADMIN_PROOF, {
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
    expect(auditMock).toHaveBeenCalledWith("billing.plan_extra_assigned", 
      expect.objectContaining({ action: "commercial_plan_extra_assigned", actorUserId: ACTOR_ID })
    );
  });

  it("un precio especial vacío se guarda como null (precio de catálogo), no como 0", async () => {
    findAddonMock.mockResolvedValueOnce(addon({ monthlyPrice: 8 }));

    await assignSalonAddonConfig(ADMIN_PROOF, { salonId: SALON_ID, addonId: ADDON_ID, priceOverride: "" });

    expect(saveOverrideMock).toHaveBeenCalledWith(ADMIN_PROOF, expect.objectContaining({ priceOverride: null }));
  });

  it("asigna un extra de módulo habilitado y fuerza cantidad uno aunque se pida otra", async () => {
    findAddonMock.mockResolvedValueOnce(
      addon({ kind: "module", moduleKey: "reports", metricKey: null, limitDelta: null, monthlyPrice: 12 })
    );

    await assignSalonAddonConfig(ADMIN_PROOF, { salonId: SALON_ID, addonId: ADDON_ID, quantity: 9 });

    expect(saveOverrideMock).toHaveBeenCalledWith(ADMIN_PROOF, 
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
    const result = await assignSalonAddonConfig(ADMIN_PROOF, { salonId: SALON_ID, addonId: "extra-x" });

    expect(result).toEqual(err("Selecciona un extra del catálogo."));
    expect(findAddonMock).not.toHaveBeenCalled();
  });

  it("devuelve el prefijo propio cuando la escritura falla", async () => {
    findAddonMock.mockResolvedValueOnce(addon());
    saveOverrideMock.mockRejectedValueOnce(new Error("constraint"));

    const result = await assignSalonAddonConfig(ADMIN_PROOF, { salonId: SALON_ID, addonId: ADDON_ID });

    expect(result).toEqual(err(expect.stringContaining("No se pudo asignar el extra.")));
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("saveSalonManualExtraConfig", () => {
  it("exige un módulo o un límite antes de tocar la base", async () => {
    const result = await saveSalonManualExtraConfig(ADMIN_PROOF, { salonId: SALON_ID });

    expect(result).toEqual(err("Selecciona un módulo o un límite para el extra."));
    expect(saveOverrideMock).not.toHaveBeenCalled();
  });

  it("para un extra de límite deja el módulo vacío y no fija habilitación", async () => {
    const result = await saveSalonManualExtraConfig(ADMIN_PROOF, {
      salonId: SALON_ID,
      metricKey: "employees_active",
      moduleEnabled: false,
      maxDelta: "3",
      isGift: false,
    });

    expect(result).toEqual(ok(undefined));
    expect(saveOverrideMock).toHaveBeenCalledWith(ADMIN_PROOF, 
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

  it("un tope fijo vacío se guarda como null (sin tope), no como 0", async () => {
    await saveSalonManualExtraConfig(ADMIN_PROOF, { salonId: SALON_ID, metricKey: "employees_active", maxOverride: "" });

    expect(saveOverrideMock).toHaveBeenCalledWith(ADMIN_PROOF, expect.objectContaining({ maxOverride: null }));
  });

  it("un incremento máximo vacío se guarda como null, no como 0", async () => {
    await saveSalonManualExtraConfig(ADMIN_PROOF, { salonId: SALON_ID, metricKey: "employees_active", maxDelta: "" });

    expect(saveOverrideMock).toHaveBeenCalledWith(ADMIN_PROOF, expect.objectContaining({ maxDelta: null }));
  });

  it("por defecto el extra manual es un regalo y un módulo sin decisión queda habilitado", async () => {
    await saveSalonManualExtraConfig(ADMIN_PROOF, { salonId: SALON_ID, moduleKey: "reports" }, ACTOR_ID);

    expect(saveOverrideMock).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({ moduleKey: "reports", moduleEnabled: true, isGift: true })
    );
    expect(auditMock).toHaveBeenCalledWith("billing.plan_override_saved", 
      expect.objectContaining({ action: "commercial_plan_override_saved", actorUserId: ACTOR_ID })
    );
  });

  it("respeta la desactivación explícita de un módulo", async () => {
    await saveSalonManualExtraConfig(ADMIN_PROOF, { salonId: SALON_ID, moduleKey: "reports", moduleEnabled: false });

    expect(saveOverrideMock).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({ moduleKey: "reports", moduleEnabled: false })
    );
  });

  it("devuelve el prefijo propio cuando la escritura falla", async () => {
    saveOverrideMock.mockRejectedValueOnce(new Error("constraint"));

    const result = await saveSalonManualExtraConfig(ADMIN_PROOF, { salonId: SALON_ID, metricKey: "employees_active" });

    expect(result).toEqual(err(expect.stringContaining("No se pudo guardar el extra.")));
  });
});
