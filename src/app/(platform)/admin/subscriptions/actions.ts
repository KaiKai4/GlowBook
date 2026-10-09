"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/infra/auth/session";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { parseUuid } from "@/infra/validation/route-id";
import {
  assignSalonAddonConfig,
  assignSalonCommercialPlanConfig,
  cancelSalonExtraConfig,
  registerSalonPlanPaymentConfig,
  resolveSalonPlanAlertConfig,
  saveSalonManualExtraConfig,
} from "@/features/billing/use-cases/salon-subscriptions";
import type { PlatformPlanActionState } from "../plans/action-state";

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function done(message: string): PlatformPlanActionState {
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/plans");
  revalidatePath("/admin/salons");
  revalidatePath("/");
  return { ok: true, message };
}

export async function assignPlanAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:assignPlanAction");
  if (!limited.ok) return { ok: false, message: limited.error };
  const result = await assignSalonCommercialPlanConfig({
    salonId: String(formData.get("salonId") ?? ""),
    planId: String(formData.get("planId") ?? ""),
    status: String(formData.get("status") ?? "trialing") as "trialing" | "active" | "past_due" | "paused" | "canceled",
    endsAt: String(formData.get("endsAt") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  }, actorUserId);

  if (!result.ok) return { ok: false, message: result.error };
  return done("Plan asignado.");
}

export async function giveAddonAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:giveAddonAction");
  if (!limited.ok) return { ok: false, message: limited.error };
  const isGift = bool(formData, "isGift");
  const result = await assignSalonAddonConfig({
    salonId: String(formData.get("salonId") ?? ""),
    addonId: String(formData.get("addonId") ?? ""),
    quantity: String(formData.get("quantity") ?? "1"),
    isGift,
    priceOverride: isGift ? "" : String(formData.get("priceOverride") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
  }, actorUserId);

  if (!result.ok) return { ok: false, message: result.error };
  return done(isGift ? "Extra regalado al salon." : "Extra asignado al salon.");
}

export async function giveManualExtraAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:giveManualExtraAction");
  if (!limited.ok) return { ok: false, message: limited.error };
  const targetType = String(formData.get("targetType") ?? "metric");
  const result = await saveSalonManualExtraConfig({
    salonId: String(formData.get("salonId") ?? ""),
    moduleKey: targetType === "module" ? String(formData.get("moduleKey") ?? "") : "",
    metricKey: targetType === "metric" ? String(formData.get("metricKey") ?? "") : "",
    moduleEnabled: targetType === "module" ? true : null,
    maxDelta: targetType === "metric" ? String(formData.get("maxDelta") ?? "") : "",
    maxOverride: "",
    isGift: true,
    reason: String(formData.get("reason") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
  }, actorUserId);

  if (!result.ok) return { ok: false, message: result.error };
  return done("Cortesia guardada.");
}

export async function registerPaymentAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:registerPaymentAction");
  if (!limited.ok) return { ok: false, message: limited.error };
  const result = await registerSalonPlanPaymentConfig({
    salonId: String(formData.get("salonId") ?? ""),
    amount: String(formData.get("amount") ?? "0"),
    paidAt: String(formData.get("paidAt") ?? "") || undefined,
    notes: String(formData.get("notes") ?? ""),
  }, actorUserId);

  if (!result.ok) return { ok: false, message: result.error };
  const state = done("Pago registrado. La suscripcion quedo activa con su mes de uso.");
  return result.warnings && result.warnings.length > 0 ? { ...state, warnings: result.warnings } : state;
}

export async function resolveAlertAction(alertId: string, salonId: string): Promise<void> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:resolveAlertAction");
  if (!limited.ok) throw new Error(limited.error);
  if (!parseUuid(alertId)) throw new Error("Identificador inválido.");
  if (!parseUuid(salonId)) throw new Error("Identificador inválido.");
  const result = await resolveSalonPlanAlertConfig(alertId, salonId, actorUserId);
  if (!result.ok) throw new Error(result.error);
  done("Alerta resuelta.");
}

export async function cancelExtraAction(overrideId: string, salonId: string): Promise<void> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:cancelExtraAction");
  if (!limited.ok) throw new Error(limited.error);
  if (!parseUuid(overrideId)) throw new Error("Identificador inválido.");
  if (!parseUuid(salonId)) throw new Error("Identificador inválido.");
  const result = await cancelSalonExtraConfig(overrideId, salonId, actorUserId);
  if (!result.ok) throw new Error(result.error);
  done("Extra cancelado.");
}
