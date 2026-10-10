import "server-only";

import type { Database } from "@/types/database.types";
import type { PlanRuleOverride, SalonPlanAssignmentStatus, SalonPlanOverride } from "../domain/commercial-plan";
import {
  parseAlertSeverity,
  parseAlertStatus,
  parseAssignmentStatus,
  parseEnforcementMode,
  parseFeatureKey,
  parseOverrideStatus,
} from "./billing-enums";

type Tables = Database["public"]["Tables"];

// Columnas de plataforma (service_role): completas.
export const ASSIGNMENT_COLUMNS =
  "id, salon_id, plan_id, status, starts_at, ends_at, trial_ends_at, current_period_start, current_period_end, notes";
export const OVERRIDE_COLUMNS =
  "id, salon_id, module_key, metric_key, module_enabled, max_delta, max_override, enforcement_mode, warning_threshold, reason, starts_at, ends_at, status, addon_id, quantity, is_gift, price_override";
export const ALERT_COLUMNS = "id, salon_id, plan_id, metric_key, module_key, severity, message, status, created_at";
export const PAYMENT_COLUMNS = "id, salon_id, plan_id, amount, currency, paid_at, period_start, period_end, notes";

// Columnas que el salón puede leer (grants de la migración 073): sin notes.
export const ASSIGNMENT_TENANT_COLUMNS =
  "id, salon_id, plan_id, status, starts_at, ends_at, trial_ends_at, current_period_start, current_period_end";
// Sin reason, price_override ni is_gift (motivo interno, importe especial y regalo).
export const OVERRIDE_TENANT_COLUMNS =
  "id, salon_id, module_key, metric_key, module_enabled, max_delta, max_override, enforcement_mode, warning_threshold, starts_at, ends_at, status, addon_id, quantity";

export type AssignmentDbRow = Pick<Tables["salon_plan_assignments"]["Row"], "id" | "salon_id" | "plan_id" | "status" | "starts_at" | "ends_at" | "trial_ends_at" | "current_period_start" | "current_period_end" | "notes">;
export type AssignmentTenantDbRow = Pick<Tables["salon_plan_assignments"]["Row"], "id" | "salon_id" | "plan_id" | "status" | "starts_at" | "ends_at" | "trial_ends_at" | "current_period_start" | "current_period_end">;
export type OverrideDbRow = Pick<Tables["salon_plan_overrides"]["Row"], "id" | "salon_id" | "module_key" | "metric_key" | "module_enabled" | "max_delta" | "max_override" | "enforcement_mode" | "warning_threshold" | "reason" | "starts_at" | "ends_at" | "status" | "addon_id" | "quantity" | "is_gift" | "price_override">;
export type OverrideTenantDbRow = Pick<Tables["salon_plan_overrides"]["Row"], "id" | "salon_id" | "module_key" | "metric_key" | "module_enabled" | "max_delta" | "max_override" | "enforcement_mode" | "warning_threshold" | "starts_at" | "ends_at" | "status" | "addon_id" | "quantity">;
export type AlertDbRow = Pick<Tables["salon_plan_alerts"]["Row"], "id" | "salon_id" | "plan_id" | "metric_key" | "module_key" | "severity" | "message" | "status" | "created_at">;

export interface AssignmentRow {
  id: string;
  salon_id: string;
  plan_id: string;
  status: SalonPlanAssignmentStatus;
  starts_at: string | null;
  ends_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  notes: string;
}

/** Asignación que puede ver el salón: AssignmentRow sin notas internas. */
export type AssignmentTenantRow = Omit<AssignmentRow, "notes">;

export interface PaymentRow {
  id: string;
  salon_id: string;
  plan_id: string | null;
  amount: number | string;
  currency: string;
  paid_at: string;
  period_start: string;
  period_end: string;
  notes: string;
}

export interface PlanAlert {
  id: string;
  salon_id: string;
  plan_id: string | null;
  metric_key: string | null;
  module_key: string | null;
  severity: "info" | "warning" | "danger";
  message: string;
  status: "open" | "acknowledged" | "resolved";
  created_at: string;
}

export function mapTenantAssignment(row: AssignmentTenantDbRow): AssignmentTenantRow {
  return {
    id: row.id,
    salon_id: row.salon_id,
    plan_id: row.plan_id,
    status: parseAssignmentStatus(row.status),
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    trial_ends_at: row.trial_ends_at,
    current_period_start: row.current_period_start,
    current_period_end: row.current_period_end,
  };
}

export function mapAssignment(row: AssignmentDbRow): AssignmentRow {
  return { ...mapTenantAssignment(row), notes: row.notes };
}

export function mapAlert(row: AlertDbRow): PlanAlert {
  return {
    id: row.id,
    salon_id: row.salon_id,
    plan_id: row.plan_id,
    metric_key: row.metric_key,
    module_key: row.module_key,
    severity: parseAlertSeverity(row.severity),
    message: row.message,
    status: parseAlertStatus(row.status),
    created_at: row.created_at,
  };
}

/** Reglas de override que sí puede leer el salón (sin motivo, precio especial ni regalo). */
export function mapTenantOverride(row: OverrideTenantDbRow): PlanRuleOverride {
  return {
    id: row.id,
    salonId: row.salon_id,
    salonName: "",
    moduleKey: row.module_key === null ? null : parseFeatureKey(row.module_key, "salon_plan_overrides.module_key"),
    metricKey: row.metric_key,
    moduleEnabled: row.module_enabled,
    maxDelta: row.max_delta,
    maxOverride: row.max_override,
    enforcementMode: row.enforcement_mode === null ? null : parseEnforcementMode(row.enforcement_mode),
    warningThreshold: row.warning_threshold,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: parseOverrideStatus(row.status),
    addonId: row.addon_id,
    quantity: row.quantity,
  };
}

export function mapOverride(row: OverrideDbRow): SalonPlanOverride {
  return {
    ...mapTenantOverride(row),
    reason: row.reason,
    isGift: row.is_gift,
    priceOverride: row.price_override === null ? null : Number(row.price_override),
  };
}
