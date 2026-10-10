import "server-only";

import type {
  PlanEnforcementMode,
  SalonPlanAssignmentStatus,
} from "../domain/commercial-plan";
import { billingDb, countOrThrow, throwOnError } from "./billing-db";

export async function recordSalonPlanPayment(values: {
  salonId: string;
  planId: string | null;
  amount: number;
  currency: string;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  notes: string;
}): Promise<void> {
  const supabase = billingDb();
  throwOnError(
    await supabase.from("salon_plan_payments").insert({
      salon_id: values.salonId,
      plan_id: values.planId,
      amount: values.amount,
      currency: values.currency,
      paid_at: values.paidAt,
      period_start: values.periodStart,
      period_end: values.periodEnd,
      notes: values.notes,
    })
  );
}

export async function activatePaidPeriod(values: {
  salonId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<void> {
  const supabase = billingDb();
  throwOnError(
    await supabase
      .from("salon_plan_assignments")
      .update({
        status: "active",
        current_period_start: values.periodStart,
        current_period_end: values.periodEnd,
      })
      .eq("salon_id", values.salonId)
  );
}

export async function assignSalonPlan(values: {
  salonId: string;
  planId: string;
  status: SalonPlanAssignmentStatus;
  startsAt: string | null;
  endsAt: string | null;
  trialEndsAt: string | null;
  notes: string;
}) {
  const supabase = billingDb();
  throwOnError(
    await supabase.from("salon_plan_assignments").upsert(
      {
        salon_id: values.salonId,
        plan_id: values.planId,
        status: values.status,
        starts_at: values.startsAt,
        ends_at: values.endsAt,
        trial_ends_at: values.trialEndsAt,
        notes: values.notes,
      },
      { onConflict: "salon_id" }
    )
  );
}

export async function saveSalonPlanOverride(values: {
  salonId: string;
  moduleKey: string | null;
  metricKey: string | null;
  moduleEnabled: boolean | null;
  maxDelta: number | null;
  maxOverride: number | null;
  enforcementMode: PlanEnforcementMode | null;
  warningThreshold: number | null;
  reason: string;
  startsAt: string | null;
  endsAt: string | null;
  status: "active" | "paused" | "canceled";
  addonId: string | null;
  quantity: number;
  isGift: boolean;
  priceOverride: number | null;
}) {
  const supabase = billingDb();
  throwOnError(
    await supabase.from("salon_plan_overrides").insert({
      salon_id: values.salonId,
      module_key: values.moduleKey,
      metric_key: values.metricKey,
      module_enabled: values.moduleEnabled,
      max_delta: values.maxDelta,
      max_override: values.maxOverride,
      enforcement_mode: values.enforcementMode,
      warning_threshold: values.warningThreshold,
      reason: values.reason,
      starts_at: values.startsAt,
      ends_at: values.endsAt,
      status: values.status,
      addon_id: values.addonId,
      quantity: values.quantity,
      is_gift: values.isGift,
      price_override: values.priceOverride,
    })
  );
}

export async function updateSalonPlanOverrideStatus(
  overrideId: string,
  status: "active" | "paused" | "canceled"
) {
  const supabase = billingDb();
  throwOnError(await supabase.from("salon_plan_overrides").update({ status }).eq("id", overrideId));
}

export async function recordPlanAlert(values: {
  salonId: string;
  planId: string | null;
  metricKey: string | null;
  moduleKey: string | null;
  severity: "info" | "warning" | "danger";
  message: string;
}) {
  const supabase = billingDb();
  throwOnError(
    await supabase.from("salon_plan_alerts").insert({
      salon_id: values.salonId,
      plan_id: values.planId,
      metric_key: values.metricKey,
      module_key: values.moduleKey,
      severity: values.severity,
      message: values.message,
    })
  );
}

export async function resolvePlanAlert(alertId: string) {
  const supabase = billingDb();
  throwOnError(await supabase.from("salon_plan_alerts").update({ status: "resolved" }).eq("id", alertId));
}

export async function hasOpenPlanAlert(salonId: string, metricKey: string): Promise<boolean> {
  const supabase = billingDb();
  const count = await supabase
    .from("salon_plan_alerts")
    .select("*", { count: "exact", head: true })
    .eq("salon_id", salonId)
    .eq("metric_key", metricKey)
    .eq("status", "open");
  return countOrThrow(count) > 0;
}
