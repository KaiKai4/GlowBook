"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { parseUuid } from "@/infra/validation/route-id";
import {
  removeCommercialPlanConfig,
  saveCommercialPlanConfig,
  saveCommercialPlanLimitsBatch,
  saveCommercialPlanModulesBatch,
  type CommercialPlan,
} from "@/features/billing/use-cases/commercial-plans";
import {
  removeCommercialAddonConfig,
  saveCommercialAddonConfig,
} from "@/features/billing/use-cases/commercial-addons";
import type { PlanLimitCountScope } from "@/features/billing/domain/commercial-plan";
import type { PlatformPlanActionState } from "./action-state";

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function done(message: string): PlatformPlanActionState {
  revalidatePath("/admin/plans");
  revalidatePath("/admin/subscriptions");
  revalidatePath("/");
  return { ok: true, message };
}

export async function savePlanAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:savePlanAction");
  if (!limited.ok) return { ok: false, message: limited.error };
  const result = await saveCommercialPlanConfig({
    id: String(formData.get("id") ?? "") || undefined,
    name: String(formData.get("name") ?? ""),
    code: String(formData.get("code") ?? ""),
    description: String(formData.get("description") ?? ""),
    monthlyPrice: String(formData.get("monthlyPrice") ?? "0"),
    currency: String(formData.get("currency") ?? "USD"),
    trialDays: String(formData.get("trialDays") ?? "0"),
    status: String(formData.get("status") ?? "draft") as "draft" | "active" | "archived",
    isPublic: bool(formData, "isPublic"),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
  }, actorUserId);

  if (!result.ok) return { ok: false, message: result.error };
  return done("Plan guardado.");
}

export async function removePlanAction(
  plan: CommercialPlan,
  hasAssignments: boolean
): Promise<void> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:removePlanAction");
  if (!limited.ok) throw new Error(limited.error);
  if (!parseUuid(plan.id)) throw new Error("Identificador inválido.");
  const result = await removeCommercialPlanConfig(plan, hasAssignments, actorUserId);
  if (!result.ok) throw new Error(result.error);
  done(hasAssignments ? "Plan archivado porque ya esta asignado." : "Plan eliminado.");
}

export async function savePlanModulesAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:savePlanModulesAction");
  if (!limited.ok) return { ok: false, message: limited.error };
  const result = await saveCommercialPlanModulesBatch({
    planId: String(formData.get("planId") ?? ""),
    allModuleKeys: formData.getAll("allModuleKeys").map(String),
    enabledModuleKeys: formData.getAll("enabledModuleKeys").map(String),
  }, actorUserId);

  if (!result.ok) return { ok: false, message: result.error };
  return done("Modulos del plan actualizados.");
}

export async function savePlanLimitsAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:savePlanLimitsAction");
  if (!limited.ok) return { ok: false, message: limited.error };
  const metricKeys = formData.getAll("metricKey").map(String);
  const limits = metricKeys.map((metricKey, index) => ({
    metricKey,
    maxValue: String(formData.getAll("maxValue")[index] ?? ""),
    enforcementMode: String(formData.getAll("enforcementMode")[index] ?? "warn") as "none" | "warn" | "block",
    warningThreshold: String(formData.getAll("warningThreshold")[index] ?? "80"),
    countScope: String(formData.getAll("countScope")[index] ?? "current") as PlanLimitCountScope,
  }));

  const result = await saveCommercialPlanLimitsBatch({
    planId: String(formData.get("planId") ?? ""),
    limits,
  }, actorUserId);

  if (!result.ok) return { ok: false, message: result.error };
  return done("Límites del plan actualizados.");
}

export async function saveAddonAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:saveAddonAction");
  if (!limited.ok) return { ok: false, message: limited.error };
  const result = await saveCommercialAddonConfig({
    id: String(formData.get("id") ?? "") || undefined,
    name: String(formData.get("name") ?? ""),
    code: String(formData.get("code") ?? ""),
    description: String(formData.get("description") ?? ""),
    kind: String(formData.get("kind") ?? "module") as "module" | "limit_boost",
    moduleKey: String(formData.get("moduleKey") ?? "") || undefined,
    metricKey: String(formData.get("metricKey") ?? "") || undefined,
    limitDelta: String(formData.get("limitDelta") ?? ""),
    currency: String(formData.get("currency") ?? "USD"),
    monthlyPrice: String(formData.get("monthlyPrice") ?? "0"),
    status: String(formData.get("status") ?? "active") as "draft" | "active" | "archived",
    sortOrder: String(formData.get("sortOrder") ?? "0"),
  }, actorUserId);

  if (!result.ok) return { ok: false, message: result.error };
  return done("Extra guardado.");
}

export async function removeAddonAction(addonId: string): Promise<void> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:removeAddonAction");
  if (!limited.ok) throw new Error(limited.error);
  if (!parseUuid(addonId)) throw new Error("Identificador inválido.");
  const result = await removeCommercialAddonConfig(addonId, actorUserId);
  if (!result.ok) throw new Error(result.error);
  done("Extra eliminado.");
}
