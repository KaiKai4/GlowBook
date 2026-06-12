import "server-only";

import { z } from "zod";

import { err, ok, type Result } from "@/lib/result";
import type {
  CommercialPlan,
  PlanLimitCountScope,
  UsageCounterKey,
} from "../domain/commercial-plan";
import type { CommercialAddon } from "../domain/salon-extras";
import {
  archiveCommercialPlan,
  deleteCommercialPlan,
  findPlanCatalog,
  saveCommercialPlan,
  saveLimitMetric,
  savePlanLimit,
  savePlanModule,
  savePlatformModule,
} from "../data/commercial-plans.repo";
import { findCommercialAddons } from "../data/commercial-addons.repo";
import { findSubscriptionRows } from "../data/salon-subscriptions.repo";
import { auditBilling, errorMessage, normalizeKey } from "./billing-shared";

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
  SalonPlanAssignment,
  SalonPlanOverride,
} from "../domain/commercial-plan";
export type { CommercialAddon } from "../domain/salon-extras";

const ModuleSchema = z.object({
  key: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2, "Escribe el nombre del modulo.").max(80),
  description: z.string().trim().max(300).default(""),
  navHref: z.string().trim().max(120).default(""),
  iconName: z.string().trim().max(80).default(""),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  isArchived: z.boolean().default(false),
});

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

const MetricSchema = z.object({
  key: z.string().trim().min(2).max(80),
  moduleKey: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2, "Escribe el nombre del límite.").max(100),
  description: z.string().trim().max(400).default(""),
  unit: z.string().trim().max(40).default(""),
  defaultCountScope: z.enum(["current", "monthly", "billing_cycle", "lifetime"]).default("current"),
  counterKey: z.enum([
    "appointments_total",
    "customers_active",
    "employees_active",
    "login_users_total",
    "services_active",
    "retail_sales_total",
    "inventory_products_active",
    "inventory_movements_total",
    "expenses_total",
  ]),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  isArchived: z.boolean().default(false),
});

const PlanModuleSchema = z.object({
  planId: z.string().uuid("Selecciona un plan."),
  moduleKey: z.string().trim().min(1, "Selecciona un modulo."),
  enabled: z.boolean().default(false),
});

const PlanLimitSchema = z.object({
  planId: z.string().uuid("Selecciona un plan."),
  metricKey: z.string().trim().min(1, "Selecciona un límite."),
  maxValue: z
    .union([z.coerce.number().int().min(0), z.literal("")])
    .transform((value) => (value === "" ? null : value))
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

export async function savePlatformModuleConfig(
  input: z.input<typeof ModuleSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = ModuleSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);
  try {
    await savePlatformModule({
      ...parsed.data,
      key: normalizeKey(parsed.data.key),
    });
    await auditBilling(actorUserId, "commercial_module_saved", parsed.data.key);
    return ok(undefined);
  } catch (error) {
    return err(errorMessage("No se pudo guardar el modulo.", error));
  }
}

export async function saveCommercialPlanConfig(
  input: z.input<typeof PlanSchema>,
  actorUserId?: string | null
): Promise<Result<string>> {
  const parsed = PlanSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);
  try {
    const id = await saveCommercialPlan({
      ...parsed.data,
      code: normalizeKey(parsed.data.code || parsed.data.name),
      currency: parsed.data.currency.toUpperCase(),
    });
    await auditBilling(actorUserId, "commercial_plan_saved", id);
    return ok(id);
  } catch (error) {
    return err(errorMessage("No se pudo guardar el plan.", error));
  }
}

export async function removeCommercialPlanConfig(
  plan: CommercialPlan,
  hasAssignments: boolean,
  actorUserId?: string | null
): Promise<Result<void>> {
  try {
    if (hasAssignments) await archiveCommercialPlan(plan.id);
    else await deleteCommercialPlan(plan.id);
    await auditBilling(actorUserId, hasAssignments ? "commercial_plan_archived" : "commercial_plan_deleted", plan.id);
    return ok(undefined);
  } catch (error) {
    return err(errorMessage("No se pudo eliminar el plan.", error));
  }
}

export async function saveCommercialPlanModuleConfig(
  input: z.input<typeof PlanModuleSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = PlanModuleSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);
  try {
    await savePlanModule(parsed.data);
    await auditBilling(actorUserId, "commercial_plan_module_saved", parsed.data.planId);
    return ok(undefined);
  } catch (error) {
    return err(errorMessage("No se pudo guardar el modulo del plan.", error));
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
  if (!parsed.success) return err(parsed.error.issues[0].message);
  const enabled = new Set(parsed.data.enabledModuleKeys);
  try {
    await Promise.all(
      parsed.data.allModuleKeys.map((moduleKey) =>
        savePlanModule({ planId: parsed.data.planId, moduleKey, enabled: enabled.has(moduleKey) })
      )
    );
    await auditBilling(actorUserId, "commercial_plan_module_saved", parsed.data.planId);
    return ok(undefined);
  } catch (error) {
    return err(errorMessage("No se pudieron guardar los modulos del plan.", error));
  }
}

export async function saveCommercialLimitMetricConfig(
  input: z.input<typeof MetricSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = MetricSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);
  try {
    await saveLimitMetric({
      ...parsed.data,
      key: normalizeKey(parsed.data.key),
      moduleKey: parsed.data.moduleKey,
      defaultCountScope: parsed.data.defaultCountScope as PlanLimitCountScope,
      counterKey: parsed.data.counterKey as UsageCounterKey,
    });
    await auditBilling(actorUserId, "commercial_limit_metric_saved", parsed.data.key);
    return ok(undefined);
  } catch (error) {
    return err(errorMessage("No se pudo guardar el límite.", error));
  }
}

export async function saveCommercialPlanLimitConfig(
  input: z.input<typeof PlanLimitSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = PlanLimitSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);
  try {
    await savePlanLimit(parsed.data);
    await auditBilling(actorUserId, "commercial_plan_limit_saved", parsed.data.planId);
    return ok(undefined);
  } catch (error) {
    return err(errorMessage("No se pudo guardar el límite del plan.", error));
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
  if (!parsed.success) return err(parsed.error.issues[0].message);
  try {
    await Promise.all(
      parsed.data.limits.map((limit) => savePlanLimit({ ...limit, planId: parsed.data.planId }))
    );
    await auditBilling(actorUserId, "commercial_plan_limit_saved", parsed.data.planId);
    return ok(undefined);
  } catch (error) {
    return err(errorMessage("No se pudieron guardar los límites del plan.", error));
  }
}
