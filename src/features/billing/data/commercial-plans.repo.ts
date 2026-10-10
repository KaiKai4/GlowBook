import "server-only";

import type {
  CommercialLimitMetric,
  CommercialPlan,
  CommercialPlanStatus,
  PlanEnforcementMode,
  PlanLimitCountScope,
  PlatformModule,
} from "../domain/commercial-plan";
import { billingDb, countOrThrow, rowsOrThrow, throwOnError, type BillingDb } from "./billing-db";
import {
  MODULE_COLUMNS,
  METRIC_COLUMNS,
  PLAN_COLUMNS,
  PLAN_LIMIT_COLUMNS,
  PLAN_MODULE_COLUMNS,
  mapMetric,
  mapModule,
  mapPlan,
  type MetricDbRow,
  type ModuleDbRow,
  type PlanDbRow,
  type PlanLimitDbRow,
  type PlanModuleDbRow,
} from "./commercial-plans.rows";

export interface PlanCatalog {
  modules: PlatformModule[];
  metrics: CommercialLimitMetric[];
  plans: CommercialPlan[];
}

export async function findPlanCatalog(): Promise<PlanCatalog> {
  const supabase = billingDb();
  const [modules, metrics, planRows, planModules, planLimits] = await Promise.all([
    supabase.from("platform_modules").select(MODULE_COLUMNS).order("sort_order", { ascending: true }),
    supabase.from("commercial_limit_metrics").select(METRIC_COLUMNS).order("sort_order", { ascending: true }),
    supabase.from("commercial_plans").select(PLAN_COLUMNS).order("sort_order", { ascending: true }),
    supabase.from("commercial_plan_modules").select(PLAN_MODULE_COLUMNS).order("module_key", { ascending: true }),
    supabase.from("commercial_plan_limits").select(PLAN_LIMIT_COLUMNS).order("metric_key", { ascending: true }),
  ]);

  const planModuleRows: PlanModuleDbRow[] = rowsOrThrow(planModules);
  const planLimitRows: PlanLimitDbRow[] = rowsOrThrow(planLimits);
  return {
    modules: rowsOrThrow<ModuleDbRow>(modules).map(mapModule),
    metrics: rowsOrThrow<MetricDbRow>(metrics).map(mapMetric),
    plans: rowsOrThrow<PlanDbRow>(planRows).map((plan) => mapPlan(plan, planModuleRows, planLimitRows)),
  };
}

/** Métricas activas. El cliente lo elige quien llama (plataforma o sesión del salón). */
export async function findActiveMetrics(supabase: BillingDb): Promise<CommercialLimitMetric[]> {
  const rows = await supabase
    .from("commercial_limit_metrics")
    .select(METRIC_COLUMNS)
    .order("sort_order", { ascending: true });
  return rowsOrThrow<MetricDbRow>(rows)
    .map(mapMetric)
    .filter((metric) => metric.isActive && !metric.isArchived);
}

/** Plan de plataforma con módulos y límites (service_role, cualquier plan). */
export async function findPlanWithChildren(planId: string): Promise<CommercialPlan | null> {
  return loadPlanWithChildren(billingDb(), planId);
}

/**
 * Plan con sus módulos y límites con el cliente indicado. Con RLS de inquilino solo
 * devuelve el plan asignado al salón (aunque esté archivado) o uno activo.
 */
export async function loadPlanWithChildren(supabase: BillingDb, planId: string): Promise<CommercialPlan | null> {
  const { data, error } = await supabase
    .from("commercial_plans")
    .select(PLAN_COLUMNS)
    .eq("id", planId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [modules, limits] = await Promise.all([
    supabase.from("commercial_plan_modules").select(PLAN_MODULE_COLUMNS).eq("plan_id", planId),
    supabase.from("commercial_plan_limits").select(PLAN_LIMIT_COLUMNS).eq("plan_id", planId),
  ]);

  return mapPlan(data, rowsOrThrow(modules), rowsOrThrow(limits));
}

export async function saveCommercialPlan(values: {
  id?: string;
  code: string;
  name: string;
  description: string;
  currency: string;
  monthlyPrice: number;
  trialDays: number;
  status: CommercialPlanStatus;
  isPublic: boolean;
  sortOrder: number;
}): Promise<string> {
  const supabase = billingDb();
  const payload = {
    code: values.code,
    name: values.name,
    description: values.description,
    currency: values.currency,
    monthly_price: values.monthlyPrice,
    trial_days: values.trialDays,
    status: values.status,
    is_public: values.isPublic,
    sort_order: values.sortOrder,
  };

  if (values.id) {
    throwOnError(await supabase.from("commercial_plans").update(payload).eq("id", values.id));
    return values.id;
  }

  const { data, error } = await supabase.from("commercial_plans").insert(payload).select("id").single();
  if (error) throw error;
  if (!data) throw new Error("No se pudo crear el plan.");
  return data.id;
}

/** Numero de asignaciones de salon a este plan (cualquier estado). */
export async function countPlanAssignments(planId: string): Promise<number> {
  const supabase = billingDb();
  return countOrThrow(
    await supabase
      .from("salon_plan_assignments")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId)
  );
}

export async function archiveCommercialPlan(planId: string) {
  const supabase = billingDb();
  throwOnError(await supabase.from("commercial_plans").update({ status: "archived" }).eq("id", planId));
}

export async function deleteCommercialPlan(planId: string) {
  const supabase = billingDb();
  throwOnError(await supabase.from("commercial_plans").delete().eq("id", planId));
}

export async function savePlanModule(values: { planId: string; moduleKey: string; enabled: boolean }) {
  const supabase = billingDb();
  throwOnError(
    await supabase.from("commercial_plan_modules").upsert(
      {
        plan_id: values.planId,
        module_key: values.moduleKey,
        enabled: values.enabled,
      },
      { onConflict: "plan_id,module_key" }
    )
  );
}

export async function savePlanLimit(values: {
  planId: string;
  metricKey: string;
  maxValue: number | null;
  enforcementMode: PlanEnforcementMode;
  warningThreshold: number;
  countScope: PlanLimitCountScope;
}) {
  const supabase = billingDb();
  throwOnError(
    await supabase.from("commercial_plan_limits").upsert(
      {
        plan_id: values.planId,
        metric_key: values.metricKey,
        max_value: values.maxValue,
        enforcement_mode: values.enforcementMode,
        warning_threshold: values.warningThreshold,
        count_scope: values.countScope,
      },
      { onConflict: "plan_id,metric_key" }
    )
  );
}
