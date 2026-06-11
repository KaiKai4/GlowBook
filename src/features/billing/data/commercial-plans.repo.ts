import "server-only";

import type { SalonFeatureKey } from "@/features/salon/domain/salon-features";
import type {
  CommercialLimitMetric,
  CommercialPlan,
  CommercialPlanLimit,
  CommercialPlanModule,
  CommercialPlanStatus,
  PlanLimitCountScope,
  PlanEnforcementMode,
  PlatformModule,
  UsageCounterKey,
} from "../domain/commercial-plan";
import { assertOk, billingDb, selectRows, selectWhere } from "./billing-db";

const MODULE_COLUMNS = "key, name, description, nav_href, icon_name, sort_order, is_active, is_archived";
const METRIC_COLUMNS =
  "key, module_key, name, description, unit, counter_key, default_count_scope, is_active, is_archived, sort_order";
const PLAN_COLUMNS = "id, code, name, description, currency, monthly_price, trial_days, status, is_public, sort_order";
const PLAN_MODULE_COLUMNS = "plan_id, module_key, enabled";
const PLAN_LIMIT_COLUMNS = "plan_id, metric_key, max_value, enforcement_mode, warning_threshold, count_scope";

interface ModuleRow {
  key: string;
  name: string;
  description: string;
  nav_href: string;
  icon_name: string;
  sort_order: number;
  is_active: boolean;
  is_archived: boolean;
}

interface PlanRow {
  id: string;
  code: string;
  name: string;
  description: string;
  currency: string;
  monthly_price: number | string;
  trial_days: number;
  status: CommercialPlanStatus;
  is_public: boolean;
  sort_order: number;
}

interface PlanModuleRow {
  plan_id: string;
  module_key: string;
  enabled: boolean;
}

interface MetricRow {
  key: string;
  module_key: string;
  name: string;
  description: string;
  unit: string;
  counter_key: UsageCounterKey;
  default_count_scope: PlanLimitCountScope;
  is_active: boolean;
  is_archived: boolean;
  sort_order: number;
}

interface PlanLimitRow {
  plan_id: string;
  metric_key: string;
  max_value: number | null;
  enforcement_mode: PlanEnforcementMode;
  warning_threshold: number;
  count_scope: PlanLimitCountScope;
}

export interface PlanCatalog {
  modules: PlatformModule[];
  metrics: CommercialLimitMetric[];
  plans: CommercialPlan[];
}

export async function findPlanCatalog(): Promise<PlanCatalog> {
  const supabase = billingDb();
  const [modules, metrics, planRows, planModules, planLimits] = await Promise.all([
    selectRows<ModuleRow>(supabase, "platform_modules", MODULE_COLUMNS, "sort_order"),
    selectRows<MetricRow>(supabase, "commercial_limit_metrics", METRIC_COLUMNS, "sort_order"),
    selectRows<PlanRow>(supabase, "commercial_plans", PLAN_COLUMNS, "sort_order"),
    selectRows<PlanModuleRow>(supabase, "commercial_plan_modules", PLAN_MODULE_COLUMNS, "module_key"),
    selectRows<PlanLimitRow>(supabase, "commercial_plan_limits", PLAN_LIMIT_COLUMNS, "metric_key"),
  ]);

  return {
    modules: modules.map(mapModule),
    metrics: metrics.map(mapMetric),
    plans: planRows.map((plan) => mapPlan(plan, planModules, planLimits)),
  };
}

export async function findActiveMetrics(): Promise<CommercialLimitMetric[]> {
  const supabase = billingDb();
  const rows = await selectRows<MetricRow>(supabase, "commercial_limit_metrics", METRIC_COLUMNS, "sort_order");
  return rows.map(mapMetric).filter((metric) => metric.isActive && !metric.isArchived);
}

export async function findActiveModules(): Promise<PlatformModule[]> {
  const supabase = billingDb();
  const rows = await selectRows<ModuleRow>(supabase, "platform_modules", MODULE_COLUMNS, "sort_order");
  return rows.map(mapModule).filter((module) => module.isActive && !module.isArchived);
}

export async function findPlanWithChildren(planId: string): Promise<CommercialPlan | null> {
  const supabase = billingDb();
  const { data, error } = await supabase
    .from("commercial_plans")
    .select(PLAN_COLUMNS)
    .eq("id", planId)
    .maybeSingle<PlanRow>();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const [modules, limits] = await Promise.all([
    selectWhere<PlanModuleRow>(supabase, "commercial_plan_modules", PLAN_MODULE_COLUMNS, "plan_id", planId),
    selectWhere<PlanLimitRow>(supabase, "commercial_plan_limits", PLAN_LIMIT_COLUMNS, "plan_id", planId),
  ]);

  return mapPlan(data, modules, limits);
}

export async function savePlatformModule(values: {
  key: string;
  name: string;
  description: string;
  navHref: string;
  iconName: string;
  sortOrder: number;
  isActive: boolean;
  isArchived: boolean;
}) {
  const supabase = billingDb();
  await assertOk(
    supabase.from("platform_modules").upsert({
      key: values.key,
      name: values.name,
      description: values.description,
      nav_href: values.navHref,
      icon_name: values.iconName,
      sort_order: values.sortOrder,
      is_active: values.isActive,
      is_archived: values.isArchived,
    }, { onConflict: "key" })
  );
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
    await assertOk(supabase.from("commercial_plans").update(payload).eq("id", values.id));
    return values.id;
  }

  const { data, error } = await supabase
    .from("commercial_plans")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No se pudo crear el plan.");
  return data.id;
}

export async function archiveCommercialPlan(planId: string) {
  const supabase = billingDb();
  await assertOk(supabase.from("commercial_plans").update({ status: "archived" }).eq("id", planId));
}

export async function deleteCommercialPlan(planId: string) {
  const supabase = billingDb();
  await assertOk(supabase.from("commercial_plans").delete().eq("id", planId));
}

export async function savePlanModule(values: {
  planId: string;
  moduleKey: string;
  enabled: boolean;
}) {
  const supabase = billingDb();
  await assertOk(
    supabase.from("commercial_plan_modules").upsert({
      plan_id: values.planId,
      module_key: values.moduleKey,
      enabled: values.enabled,
    }, { onConflict: "plan_id,module_key" })
  );
}

export async function saveLimitMetric(values: {
  key: string;
  moduleKey: string;
  name: string;
  description: string;
  unit: string;
  counterKey: UsageCounterKey;
  defaultCountScope: PlanLimitCountScope;
  sortOrder: number;
  isActive: boolean;
  isArchived: boolean;
}) {
  const supabase = billingDb();
  await assertOk(
    supabase.from("commercial_limit_metrics").upsert({
      key: values.key,
      module_key: values.moduleKey,
      name: values.name,
      description: values.description,
      unit: values.unit,
      counter_key: values.counterKey,
      default_count_scope: values.defaultCountScope,
      sort_order: values.sortOrder,
      is_active: values.isActive,
      is_archived: values.isArchived,
    }, { onConflict: "key" })
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
  await assertOk(
    supabase.from("commercial_plan_limits").upsert({
      plan_id: values.planId,
      metric_key: values.metricKey,
      max_value: values.maxValue,
      enforcement_mode: values.enforcementMode,
      warning_threshold: values.warningThreshold,
      count_scope: values.countScope,
    }, { onConflict: "plan_id,metric_key" })
  );
}

function mapModule(row: ModuleRow): PlatformModule {
  return {
    key: row.key as SalonFeatureKey,
    name: row.name,
    description: row.description,
    navHref: row.nav_href,
    iconName: row.icon_name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isArchived: row.is_archived,
  };
}

function mapMetric(row: MetricRow): CommercialLimitMetric {
  return {
    key: row.key,
    moduleKey: row.module_key as SalonFeatureKey,
    name: row.name,
    description: row.description,
    unit: row.unit,
    counterKey: row.counter_key,
    defaultCountScope: row.default_count_scope,
    isActive: row.is_active,
    isArchived: row.is_archived,
    sortOrder: row.sort_order,
  };
}

function mapPlan(
  row: PlanRow,
  moduleRows: PlanModuleRow[],
  limitRows: PlanLimitRow[]
): CommercialPlan {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    currency: row.currency,
    monthlyPrice: Number(row.monthly_price),
    trialDays: row.trial_days,
    status: row.status,
    isPublic: row.is_public,
    sortOrder: row.sort_order,
    modules: moduleRows
      .filter((module) => module.plan_id === row.id)
      .map(mapPlanModule),
    limits: limitRows
      .filter((limit) => limit.plan_id === row.id)
      .map(mapPlanLimit),
  };
}

function mapPlanModule(row: PlanModuleRow): CommercialPlanModule {
  return {
    moduleKey: row.module_key as SalonFeatureKey,
    enabled: row.enabled,
  };
}

function mapPlanLimit(row: PlanLimitRow): CommercialPlanLimit {
  return {
    metricKey: row.metric_key,
    maxValue: row.max_value,
    enforcementMode: row.enforcement_mode,
    warningThreshold: row.warning_threshold,
    countScope: row.count_scope,
  };
}
