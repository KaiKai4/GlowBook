import "server-only";

import type {
  PlanEnforcementMode,
  SalonPlanAssignmentStatus,
  SalonPlanOverride,
} from "../domain/commercial-plan";

export const ASSIGNMENT_COLUMNS =
  "id, salon_id, plan_id, status, starts_at, ends_at, trial_ends_at, current_period_start, current_period_end, notes";
export const OVERRIDE_COLUMNS =
  "id, salon_id, module_key, metric_key, module_enabled, max_delta, max_override, enforcement_mode, warning_threshold, reason, starts_at, ends_at, status, addon_id, quantity, is_gift, price_override";
export const ALERT_COLUMNS = "id, salon_id, plan_id, metric_key, module_key, severity, message, status, created_at";

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

export interface OverrideRow {
  id: string;
  salon_id: string;
  module_key: string | null;
  metric_key: string | null;
  module_enabled: boolean | null;
  max_delta: number | null;
  max_override: number | null;
  enforcement_mode: PlanEnforcementMode | null;
  warning_threshold: number | null;
  reason: string;
  starts_at: string | null;
  ends_at: string | null;
  status: "active" | "paused" | "canceled";
  addon_id: string | null;
  quantity: number;
  is_gift: boolean;
  price_override: number | string | null;
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

export function mapOverride(row: OverrideRow): SalonPlanOverride {
  return {
    id: row.id,
    salonId: row.salon_id,
    salonName: "",
    moduleKey: row.module_key as SalonPlanOverride["moduleKey"],
    metricKey: row.metric_key,
    moduleEnabled: row.module_enabled,
    maxDelta: row.max_delta,
    maxOverride: row.max_override,
    enforcementMode: row.enforcement_mode,
    warningThreshold: row.warning_threshold,
    reason: row.reason,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    addonId: row.addon_id,
    quantity: row.quantity,
    isGift: row.is_gift,
    priceOverride: row.price_override === null ? null : Number(row.price_override),
  };
}
