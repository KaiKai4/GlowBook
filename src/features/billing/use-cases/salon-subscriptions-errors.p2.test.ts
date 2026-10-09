import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import { PublicError } from "@/lib/public-error";
import { findCommercialAddonById } from "../data/commercial-addons.repo";
import { findPlanWithChildren } from "../data/commercial-plans.repo";
import {
  activatePaidPeriod,
  assignSalonPlan,
  findAssignmentForPayment,
  findAssignmentStartsAt,
  recordSalonPlanPayment,
  resolvePlanAlert,
  saveSalonPlanOverride,
  updateSalonPlanOverrideStatus,
} from "../data/salon-subscriptions.repo";
import { auditBilling } from "./billing-shared";
import {
  assignSalonAddonConfig,
  assignSalonCommercialPlanConfig,
  autoAssignPlanOnAcceptance,
  cancelSalonExtraConfig,
  registerSalonPlanPaymentConfig,
  resolveSalonPlanAlertConfig,
  saveSalonManualExtraConfig,
} from "./salon-subscriptions";

vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));
vi.mock("./billing-shared", () => ({
  auditBilling: vi.fn(async () => []),
  dateOrNull: (value?: string | null) => (value ? value : null),
  normalizeKey: (value: string) => value,
}));
vi.mock("../data/commercial-addons.repo", () => ({
  findCommercialAddonById: vi.fn(),
  findCommercialAddons: vi.fn(),
}));
vi.mock("../data/commercial-plans.repo", () => ({
  findPlanCatalog: vi.fn(),
  findPlanWithChildren: vi.fn(),
}));
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

const ACTOR = "00000000-0000-4000-8000-0000000000ad";
const SALON = "00000000-0000-4000-8000-000000000005";
const PLAN = "00000000-0000-4000-8000-0000000000b1";
const ADDON = "00000000-0000-4000-8000-000000000a01";
const ALERT = "00000000-0000-4000-8000-0000000000a1";
const OVERRIDE = "00000000-0000-4000-8000-0000000000c1";

function pgError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findAssignmentStartsAt).mockResolvedValue(null as never);
});

describe("alertas del plan", () => {
  it("resolver una alerta que ya no existe devuelve el RAISE seguro de la base", async () => {
    vi.mocked(resolvePlanAlert).mockRejectedValue(pgError("P0001", "La alerta ya no esta abierta."));

    const result = await resolveSalonPlanAlertConfig(ALERT, SALON, ACTOR);

    expect(result).toEqual({ ok: false, error: "La alerta ya no esta abierta." });
    expect(auditBilling).not.toHaveBeenCalled();
  });

  it("un fallo interno al resolver usa el mensaje de respaldo y registra el error", async () => {
    const failure = pgError("XX000", "internal error in policy");
    vi.mocked(resolvePlanAlert).mockRejectedValue(failure);

    const result = await resolveSalonPlanAlertConfig(ALERT, SALON, ACTOR);

    expect(result).toEqual({ ok: false, error: "No se pudo resolver la alerta." });
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("resuelve la alerta y audita", async () => {
    vi.mocked(resolvePlanAlert).mockResolvedValue(undefined as never);

    const result = await resolveSalonPlanAlertConfig(ALERT, SALON, ACTOR);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(auditBilling).toHaveBeenCalledWith(ACTOR, "commercial_plan_alert_resolved", SALON);
  });
});

describe("asignar plan al salon", () => {
  it("valida los identificadores antes de consultar nada", async () => {
    const result = await assignSalonCommercialPlanConfig({ salonId: "x", planId: PLAN }, ACTOR);

    expect(result).toEqual({ ok: false, error: "Selecciona un salon." });
    expect(assignSalonPlan).not.toHaveBeenCalled();
  });

  it("si el plan no existe no asigna nada", async () => {
    vi.mocked(findPlanWithChildren).mockResolvedValue(null as never);

    const result = await assignSalonCommercialPlanConfig({ salonId: SALON, planId: PLAN }, ACTOR);

    expect(result).toEqual({ ok: false, error: "El plan seleccionado no existe." });
    expect(assignSalonPlan).not.toHaveBeenCalled();
  });

  it("asigna el plan, usa la programacion derivada y audita", async () => {
    vi.mocked(findPlanWithChildren).mockResolvedValue({ id: PLAN, trialDays: 0 } as never);
    vi.mocked(assignSalonPlan).mockResolvedValue(undefined as never);

    const result = await assignSalonCommercialPlanConfig(
      { salonId: SALON, planId: PLAN, status: "active", notes: "alta" },
      ACTOR
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(assignSalonPlan).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: SALON, planId: PLAN, status: "active", notes: "alta", endsAt: null })
    );
    expect(auditBilling).toHaveBeenCalledWith(ACTOR, "commercial_plan_assigned", SALON);
  });

  it("si la escritura falla devuelve el mensaje de respaldo", async () => {
    vi.mocked(findPlanWithChildren).mockResolvedValue({ id: PLAN, trialDays: 0 } as never);
    vi.mocked(assignSalonPlan).mockRejectedValue(pgError("23503", "fk violation"));

    const result = await assignSalonCommercialPlanConfig({ salonId: SALON, planId: PLAN }, ACTOR);

    expect(result).toEqual({ ok: false, error: "La operación hace referencia a un registro inexistente." });
  });

  it("la asignacion automatica por invitacion sin plan informa del problema", async () => {
    vi.mocked(findPlanWithChildren).mockResolvedValue(null as never);

    const result = await autoAssignPlanOnAcceptance({ salonId: SALON, planId: PLAN, acceptedByUserId: ACTOR });

    expect(result).toEqual({ ok: false, error: "El plan de la invitacion ya no existe." });
  });

  it("la asignacion automatica que falla usa su mensaje de respaldo", async () => {
    vi.mocked(findPlanWithChildren).mockResolvedValue({ id: PLAN, trialDays: 0 } as never);
    vi.mocked(assignSalonPlan).mockRejectedValue(new PublicError("El salón ya tiene un plan activo."));

    const passthrough = await autoAssignPlanOnAcceptance({ salonId: SALON, planId: PLAN, acceptedByUserId: ACTOR });
    expect(passthrough).toEqual({ ok: false, error: "El salón ya tiene un plan activo." });

    vi.mocked(assignSalonPlan).mockRejectedValue(new Error("timeout"));
    const fallback = await autoAssignPlanOnAcceptance({ salonId: SALON, planId: PLAN, acceptedByUserId: ACTOR });
    expect(fallback).toEqual({ ok: false, error: "No se pudo asignar el plan de la invitacion." });
  });
});

describe("registrar pago del plan", () => {
  it("rechaza un monto negativo y una fecha con formato incorrecto", async () => {
    expect(await registerSalonPlanPaymentConfig({ salonId: SALON, amount: "-5" })).toEqual({
      ok: false,
      error: "El monto no puede ser negativo.",
    });
    expect(await registerSalonPlanPaymentConfig({ salonId: SALON, amount: "5", paidAt: "01/06/2026" })).toEqual({
      ok: false,
      error: "Fecha de pago inválida.",
    });
    expect(findAssignmentForPayment).not.toHaveBeenCalled();
  });

  it("sin plan asignado pide asignar uno primero", async () => {
    vi.mocked(findAssignmentForPayment).mockResolvedValue(null as never);

    const result = await registerSalonPlanPaymentConfig({ salonId: SALON, amount: "10" });

    expect(result).toEqual({
      ok: false,
      error: "Este salon no tiene plan asignado. Asignale un plan primero.",
    });
  });

  it("si la escritura del pago falla usa el mensaje de respaldo", async () => {
    vi.mocked(findAssignmentForPayment).mockResolvedValue({ plan_id: PLAN, current_period_end: null } as never);
    vi.mocked(findPlanWithChildren).mockResolvedValue({ id: PLAN, trialDays: 0 } as never);
    vi.mocked(recordSalonPlanPayment).mockRejectedValue(new Error("network"));

    const result = await registerSalonPlanPaymentConfig({ salonId: SALON, amount: "10", paidAt: "2026-06-01" });

    expect(result).toEqual({ ok: false, error: "No se pudo registrar el pago." });
    expect(activatePaidPeriod).not.toHaveBeenCalled();
  });
});

describe("extras del salon", () => {
  it("valida el extra del catalogo y su estado antes de asignarlo", async () => {
    expect(await assignSalonAddonConfig({ salonId: SALON, addonId: "x" })).toEqual({
      ok: false,
      error: "Selecciona un extra del catalogo.",
    });

    vi.mocked(findCommercialAddonById).mockResolvedValueOnce(null as never);
    expect(await assignSalonAddonConfig({ salonId: SALON, addonId: ADDON })).toEqual({
      ok: false,
      error: "El extra del catalogo no existe.",
    });

    vi.mocked(findCommercialAddonById).mockResolvedValueOnce({ id: ADDON, status: "archived" } as never);
    expect(await assignSalonAddonConfig({ salonId: SALON, addonId: ADDON })).toEqual({
      ok: false,
      error: "Este extra no esta activo en el catalogo.",
    });
    expect(saveSalonPlanOverride).not.toHaveBeenCalled();
  });

  it("asigna un extra activo, audita y propaga el motivo de dominio si falla", async () => {
    vi.mocked(findCommercialAddonById).mockResolvedValue({ id: ADDON, status: "active" } as never);
    vi.mocked(saveSalonPlanOverride).mockResolvedValueOnce(undefined as never);

    expect(await assignSalonAddonConfig({ salonId: SALON, addonId: ADDON, quantity: "2" }, ACTOR)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(auditBilling).toHaveBeenCalledWith(ACTOR, "commercial_plan_extra_assigned", SALON);

    vi.mocked(saveSalonPlanOverride).mockRejectedValueOnce(new PublicError("Ya tiene ese extra."));
    expect(await assignSalonAddonConfig({ salonId: SALON, addonId: ADDON }, ACTOR)).toEqual({
      ok: false,
      error: "Ya tiene ese extra.",
    });
  });

  it("un cortesia manual sin modulo ni limite se rechaza", async () => {
    const result = await saveSalonManualExtraConfig({ salonId: SALON, moduleKey: "", metricKey: "", maxDelta: "" });

    expect(result).toEqual({ ok: false, error: "Selecciona un modulo o un límite para el extra." });
    expect(saveSalonPlanOverride).not.toHaveBeenCalled();
  });

  it("si guardar la cortesia falla usa el mensaje de respaldo", async () => {
    vi.mocked(saveSalonPlanOverride).mockRejectedValue(new Error("boom"));

    const result = await saveSalonManualExtraConfig({
      salonId: SALON,
      metricKey: "appointments",
      maxDelta: "5",
      isGift: true,
    });

    expect(result).toEqual({ ok: false, error: "No se pudo guardar el extra." });
  });

  it("cancelar un extra cambia su estado y audita; si falla usa el mensaje de respaldo", async () => {
    vi.mocked(updateSalonPlanOverrideStatus).mockResolvedValueOnce(undefined as never);
    expect(await cancelSalonExtraConfig(OVERRIDE, SALON, ACTOR)).toEqual({ ok: true, value: undefined });
    expect(updateSalonPlanOverrideStatus).toHaveBeenCalledWith(OVERRIDE, "canceled");
    expect(auditBilling).toHaveBeenCalledWith(ACTOR, "commercial_plan_extra_canceled", SALON);

    vi.mocked(updateSalonPlanOverrideStatus).mockRejectedValueOnce(new Error("timeout"));
    expect(await cancelSalonExtraConfig(OVERRIDE, SALON, ACTOR)).toEqual({
      ok: false,
      error: "No se pudo cancelar el extra.",
    });
  });
});
