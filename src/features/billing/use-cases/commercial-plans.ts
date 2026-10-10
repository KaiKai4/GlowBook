import { toPublicErrorMessage } from "@/infra/errors";
import "server-only";

import { z } from "@/infra/validation/zod";

import { err, ok, type Result } from "@/infra/result";
import type { CommercialPlan } from "../domain/commercial-plan";
import type { CommercialAddon } from "../domain/salon-extras";
import {
  archiveCommercialPlan,
  countPlanAssignments,
  deleteCommercialPlan,
  findPlanCatalog,
  saveCommercialPlan,
  savePlanLimit,
  savePlanModule,
} from "../data/commercial-plans.repo";
import { findCommercialAddons } from "../data/commercial-addons.repo";
import { findSubscriptionRows } from "../data/salon-subscriptions.repo";
import { commercialPlanAudit, normalizeKey } from "./billing-shared";
import { publishAuditEvent } from "@/features/audit";

// Re-exports: las actions del dashboard y el shell consultan el plan efectivo
// a traves de este modulo.
export {
  checkPlanLimit,
  checkPlanModuleAccess,
  getEffectiveDisabledSalonFeatures,
  getEffectiveSalonPlan,
  isEffectiveSalonModuleEnabled,
} from "./salon-subscriptions";

export type {
  CommercialLimitMetric,
  CommercialPlan,
  PlatformModule,
} from "../domain/commercial-plan";
export type { CommercialAddon } from "../domain/salon-extras";
import { firstIssueMessage } from "@/infra/validation/first-issue";

const PlanSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Escribe el nombre del plan.").max(100),
  code: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).default(""),
  currency: z.string().trim().length(3).default("USD"),
  monthlyPrice: z.coerce.number().min(0, "El precio no puede ser negativo."),
  trialDays: z.coerce.number().int().min(0, "El trial no puede ser negativo.").default(0),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  isPublic: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

const PlanLimitSchema = z.object({
  planId: z.string().uuid("Selecciona un plan."),
  metricKey: z.string().trim().min(1, "Selecciona un límite."),
  // "" evaluado antes que coerce: vacío = sin límite (null), nunca tope 0.
  maxValue: z
    .union([z.literal("").transform(() => null), z.coerce.number().int().min(0)])
    .nullable()
    .default(null),
  enforcementMode: z.enum(["none", "warn", "block"]).default("warn"),
  warningThreshold: z.coerce.number().int().min(1).max(100).default(80),
  countScope: z.enum(["current", "monthly", "billing_cycle", "lifetime"]).default("current"),
});

export interface CommercialPlansPageData {
  modules: Awaited<ReturnType<typeof findPlanCatalog>>["modules"];
  metrics: Awaited<ReturnType<typeof findPlanCatalog>>["metrics"];
  plans: CommercialPlan[];
  addons: CommercialAddon[];
  assignmentsByPlan: Record<string, number>;
}

/** Catalogo minimo de planes para otros features (ej. invitaciones). */
export async function getPlanCatalogSummary(): Promise<
  Array<Pick<CommercialPlan, "id" | "name" | "currency" | "monthlyPrice" | "trialDays" | "status">>
> {
  const catalog = await findPlanCatalog();
  return catalog.plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    currency: plan.currency,
    monthlyPrice: plan.monthlyPrice,
    trialDays: plan.trialDays,
    status: plan.status,
  }));
}

export async function getCommercialPlansPage(): Promise<CommercialPlansPageData> {
  const [catalog, addons, subscription] = await Promise.all([
    findPlanCatalog(),
    findCommercialAddons(),
    findSubscriptionRows(),
  ]);

  const assignmentsByPlan: Record<string, number> = {};
  for (const assignment of subscription.assignments) {
    assignmentsByPlan[assignment.plan_id] = (assignmentsByPlan[assignment.plan_id] ?? 0) + 1;
  }

  return {
    modules: catalog.modules,
    metrics: catalog.metrics,
    plans: catalog.plans,
    addons,
    assignmentsByPlan,
  };
}

export async function saveCommercialPlanConfig(
  input: z.input<typeof PlanSchema>,
  actorUserId?: string | null
): Promise<Result<string>> {
  const parsed = PlanSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  try {
    const id = await saveCommercialPlan({
      ...parsed.data,
      code: normalizeKey(parsed.data.code || parsed.data.name),
      currency: parsed.data.currency.toUpperCase(),
    });
    const warnings = await publishAuditEvent("billing.plan_saved", { ...commercialPlanAudit(actorUserId, id), action: "commercial_plan_saved" });
    return ok(id, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo guardar el plan."));
  }
}

/** Archiva el plan: lo retira del catalogo sin tocar las asignaciones existentes. */
export async function archivePlan(planId: string, actorUserId?: string | null): Promise<Result<void>> {
  try {
    await archiveCommercialPlan(planId);
    const warnings = await publishAuditEvent("billing.plan_archived", { ...commercialPlanAudit(actorUserId, planId), action: "commercial_plan_archived" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo archivar el plan."));
  }
}

const PLAN_HAS_ASSIGNMENTS_MESSAGE = "El plan tiene salones asignados. Archívalo en lugar de eliminarlo.";

/** Borra el plan solo si ningun salon lo tiene asignado; el conteo lo hace el servidor. */
export async function deletePlan(planId: string, actorUserId?: string | null): Promise<Result<void>> {
  try {
    if ((await countPlanAssignments(planId)) > 0) return err(PLAN_HAS_ASSIGNMENTS_MESSAGE);
    await deleteCommercialPlan(planId);
    const warnings = await publishAuditEvent("billing.plan_deleted", { ...commercialPlanAudit(actorUserId, planId), action: "commercial_plan_deleted" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo eliminar el plan."));
  }
}

const PlanModulesBatchSchema = z.object({
  planId: z.string().uuid("Selecciona un plan."),
  enabledModuleKeys: z.array(z.string().trim().min(1)).default([]),
  allModuleKeys: z.array(z.string().trim().min(1)).min(1, "No hay modulos para guardar."),
});

export async function saveCommercialPlanModulesBatch(
  input: z.input<typeof PlanModulesBatchSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = PlanModulesBatchSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  const enabled = new Set(parsed.data.enabledModuleKeys);
  try {
    await Promise.all(
      parsed.data.allModuleKeys.map((moduleKey) =>
        savePlanModule({ planId: parsed.data.planId, moduleKey, enabled: enabled.has(moduleKey) })
      )
    );
    const warnings = await publishAuditEvent("billing.plan_module_saved", { ...commercialPlanAudit(actorUserId, parsed.data.planId), action: "commercial_plan_module_saved" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudieron guardar los modulos del plan."));
  }
}

const PlanLimitsBatchSchema = z.object({
  planId: z.string().uuid("Selecciona un plan."),
  limits: z.array(PlanLimitSchema.omit({ planId: true })).min(1, "No hay límites para guardar."),
});

export async function saveCommercialPlanLimitsBatch(
  input: z.input<typeof PlanLimitsBatchSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = PlanLimitsBatchSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  try {
    await Promise.all(
      parsed.data.limits.map((limit) => savePlanLimit({ ...limit, planId: parsed.data.planId }))
    );
    const warnings = await publishAuditEvent("billing.plan_limit_saved", { ...commercialPlanAudit(actorUserId, parsed.data.planId), action: "commercial_plan_limit_saved" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudieron guardar los límites del plan."));
  }
}
