import "server-only";

import type { Database } from "@/types/database.types";
import type { CommercialLimitMetric, CommercialPlan, CommercialPlanLimit, CommercialPlanModule, PlatformModule } from "../domain/commercial-plan";
import {
  parseCountScope,
  parseCounterKey,
  parseEnforcementMode,
  parseFeatureKey,
  parsePlanStatus,
} from "./billing-enums";

type DbRow<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export const MODULE_COLUMNS = "key, name, description, nav_href, icon_name, sort_order, is_active, is_archived";
export const METRIC_COLUMNS =
  "key, module_key, name, description, unit, counter_key, default_count_scope, is_active, is_archived, sort_order";
export const PLAN_COLUMNS = "id, code, name, description, currency, monthly_price, trial_days, status, is_public, sort_order";
export const PLAN_MODULE_COLUMNS = "plan_id, module_key, enabled";
export const PLAN_LIMIT_COLUMNS = "plan_id, metric_key, max_value, enforcement_mode, warning_threshold, count_scope";

export type ModuleDbRow = Pick<
  DbRow<"platform_modules">,
  "key" | "name" | "description" | "nav_href" | "icon_name" | "sort_order" | "is_active" | "is_archived"
>;
export type MetricDbRow = Pick<
  DbRow<"commercial_limit_metrics">,
  | "key"
  | "module_key"
  | "name"
  | "description"
  | "unit"
  | "counter_key"
  | "default_count_scope"
  | "is_active"
  | "is_archived"
  | "sort_order"
>;
export type PlanDbRow = Pick<
  DbRow<"commercial_plans">,
  "id" | "code" | "name" | "description" | "currency" | "monthly_price" | "trial_days" | "status" | "is_public" | "sort_order"
>;
export type PlanModuleDbRow = Pick<DbRow<"commercial_plan_modules">, "plan_id" | "module_key" | "enabled">;
export type PlanLimitDbRow = Pick<
  DbRow<"commercial_plan_limits">,
  "plan_id" | "metric_key" | "max_value" | "enforcement_mode" | "warning_threshold" | "count_scope"
>;

export function mapModule(row: ModuleDbRow): PlatformModule {
  return {
    key: parseFeatureKey(row.key, "platform_modules.key"),
    name: row.name,
    description: row.description,
    navHref: row.nav_href,
    iconName: row.icon_name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isArchived: row.is_archived,
  };
}

export function mapMetric(row: MetricDbRow): CommercialLimitMetric {
  return {
    key: row.key,
    moduleKey: parseFeatureKey(row.module_key, "commercial_limit_metrics.module_key"),
    name: row.name,
    description: row.description,
    unit: row.unit,
    counterKey: parseCounterKey(row.counter_key),
    defaultCountScope: parseCountScope(row.default_count_scope),
    isActive: row.is_active,
    isArchived: row.is_archived,
    sortOrder: row.sort_order,
  };
}

export function mapPlan(row: PlanDbRow, moduleRows: PlanModuleDbRow[], limitRows: PlanLimitDbRow[]): CommercialPlan {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    currency: row.currency,
    monthlyPrice: Number(row.monthly_price),
    trialDays: row.trial_days,
    status: parsePlanStatus(row.status),
    isPublic: row.is_public,
    sortOrder: row.sort_order,
    modules: moduleRows.filter((module) => module.plan_id === row.id).map(mapPlanModule),
    limits: limitRows.filter((limit) => limit.plan_id === row.id).map(mapPlanLimit),
  };
}

function mapPlanModule(row: PlanModuleDbRow): CommercialPlanModule {
  return {
    moduleKey: parseFeatureKey(row.module_key, "commercial_plan_modules.module_key"),
    enabled: row.enabled,
  };
}

function mapPlanLimit(row: PlanLimitDbRow): CommercialPlanLimit {
  return {
    metricKey: row.metric_key,
    maxValue: row.max_value,
    enforcementMode: parseEnforcementMode(row.enforcement_mode),
    warningThreshold: row.warning_threshold,
    countScope: parseCountScope(row.count_scope),
  };
}
