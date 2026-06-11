"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/lib/auth/session";
import {
  removeCommercialPlanConfig,
  saveCommercialLimitMetricConfig,
  saveCommercialPlanConfig,
  saveCommercialPlanLimitsBatch,
  saveCommercialPlanModulesBatch,
  savePlatformModuleConfig,
  type CommercialPlan,
} from "@/features/billing/use-cases/commercial-plans";
import {
  removeCommercialAddonConfig,
  saveCommercialAddonConfig,
} from "@/features/billing/use-cases/commercial-addons";
import type {
  PlanLimitCountScope,
  UsageCounterKey,
} from "@/features/billing/domain/commercial-plan";
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
  const result = await removeCommercialPlanConfig(plan, hasAssignments, actorUserId);
  if (!result.ok) throw new Error(result.error);
  done(hasAssignments ? "Plan archivado porque ya esta asignado." : "Plan eliminado.");
}

export async function saveModuleAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  const actorUserId = await requirePlatformAdmin();
  const result = await savePlatformModuleConfig({
    key: String(formData.get("key") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    navHref: String(formData.get("navHref") ?? ""),
    iconName: String(formData.get("iconName") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
    isActive: bool(formData, "isActive"),
    isArchived: bool(formData, "isArchived"),
  }, actorUserId);

  if (!result.ok) return { ok: false, message: result.error };
  return done("Modulo guardado.");
}

export async function saveMetricAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  const actorUserId = await requirePlatformAdmin();
  const result = await saveCommercialLimitMetricConfig({
    key: String(formData.get("key") ?? ""),
    moduleKey: String(formData.get("moduleKey") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    defaultCountScope: String(formData.get("defaultCountScope") ?? "current") as PlanLimitCountScope,
    counterKey: String(formData.get("counterKey") ?? "appointments_total") as UsageCounterKey,
    sortOrder: String(formData.get("sortOrder") ?? "0"),
    isActive: bool(formData, "isActive"),
    isArchived: bool(formData, "isArchived"),
  }, actorUserId);

  if (!result.ok) return { ok: false, message: result.error };
  return done("Limite guardado.");
}

export async function savePlanModulesAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  const actorUserId = await requirePlatformAdmin();
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
  return done("Limites del plan actualizados.");
}

export async function saveAddonAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  const actorUserId = await requirePlatformAdmin();
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
  const result = await removeCommercialAddonConfig(addonId, actorUserId);
  if (!result.ok) throw new Error(result.error);
  done("Extra eliminado.");
}
