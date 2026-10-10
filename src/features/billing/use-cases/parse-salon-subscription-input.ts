import { formFlag, formText, type FormFieldSource } from "@/infra/validation/form-fields";
import type { assignSalonAddonConfig, saveSalonManualExtraConfig } from "./salon-plan-extras";
import type { assignSalonCommercialPlanConfig, registerSalonPlanPaymentConfig } from "./salon-plan-assignment";

// Lectura de los formularios de suscripciones de salon: fija aquí las reglas de
// formulario (estado por defecto, regalo que ignora el precio, cortesia por
// modulo o por metrica, pago sin fecha). Sin I/O: se prueba directamente.

export type AssignPlanInput = Parameters<typeof assignSalonCommercialPlanConfig>[0];
export type GiveAddonInput = Parameters<typeof assignSalonAddonConfig>[0];
export type ManualExtraInput = Parameters<typeof saveSalonManualExtraConfig>[0];
export type RegisterPaymentInput = Parameters<typeof registerSalonPlanPaymentConfig>[0];

export function readAssignPlanInput(source: FormFieldSource): AssignPlanInput {
  return {
    salonId: formText(source.get("salonId")),
    planId: formText(source.get("planId")),
    status: formText(source.get("status"), "trialing") as
      | "trialing"
      | "active"
      | "past_due"
      | "paused"
      | "canceled",
    endsAt: formText(source.get("endsAt")),
    notes: formText(source.get("notes")),
  };
}

/** Un regalo no lleva precio: se ignora el indicado y se marca isGift. */
export function readGiveAddonInput(source: FormFieldSource): GiveAddonInput {
  const isGift = formFlag(source.get("isGift"));
  return {
    salonId: formText(source.get("salonId")),
    addonId: formText(source.get("addonId")),
    quantity: formText(source.get("quantity"), "1"),
    isGift,
    priceOverride: isGift ? "" : formText(source.get("priceOverride")),
    reason: formText(source.get("reason")),
    startsAt: formText(source.get("startsAt")),
    endsAt: formText(source.get("endsAt")),
  };
}

/**
 * Cortesia manual: el tipo decide si va un modulo (se habilita) o una metrica
 * (se suma el delta). El campo que no corresponde se envia vacio.
 */
export function readManualExtraInput(source: FormFieldSource): ManualExtraInput {
  const targetType = formText(source.get("targetType"), "metric");
  const isModule = targetType === "module";
  const isMetric = targetType === "metric";
  return {
    salonId: formText(source.get("salonId")),
    moduleKey: isModule ? formText(source.get("moduleKey")) : "",
    metricKey: isMetric ? formText(source.get("metricKey")) : "",
    moduleEnabled: isModule ? true : null,
    maxDelta: isMetric ? formText(source.get("maxDelta")) : "",
    maxOverride: "",
    isGift: true,
    reason: formText(source.get("reason")),
    startsAt: formText(source.get("startsAt")),
    endsAt: formText(source.get("endsAt")),
  };
}

/** Sin fecha de pago el campo va indefinido (no se envia cadena vacia). */
export function readRegisterPaymentInput(source: FormFieldSource): RegisterPaymentInput {
  return {
    salonId: formText(source.get("salonId")),
    amount: formText(source.get("amount"), "0"),
    paidAt: formText(source.get("paidAt")) || undefined,
    notes: formText(source.get("notes")),
  };
}
