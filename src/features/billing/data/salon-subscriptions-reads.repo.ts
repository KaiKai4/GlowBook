import "server-only";

import type { SalonPlanOverride } from "../domain/commercial-plan";
import { billingDb, rowsOrThrow, type BillingDb } from "./billing-db";
import { findActiveMetrics, findPlanWithChildren } from "./commercial-plans.repo";
import { calculateSalonUsage } from "./salon-subscriptions-usage.repo";
import {
  ALERT_COLUMNS,
  ASSIGNMENT_COLUMNS,
  OVERRIDE_COLUMNS,
  PAYMENT_COLUMNS,
  mapAlert,
  mapAssignment,
  mapOverride,
  type AlertDbRow,
  type AssignmentDbRow,
  type AssignmentRow,
  type OverrideDbRow,
  type PaymentRow,
  type PlanAlert,
} from "./salon-subscriptions.rows";

export async function findSubscriptionRows() {
  const supabase = billingDb();
  const [assignments, overrides, alerts] = await Promise.all([
    supabase.from("salon_plan_assignments").select(ASSIGNMENT_COLUMNS).order("created_at", { ascending: true }),
    supabase.from("salon_plan_overrides").select(OVERRIDE_COLUMNS).order("created_at", { ascending: true }),
    supabase.from("salon_plan_alerts").select(ALERT_COLUMNS).order("created_at", { ascending: true }),
  ]);
  return {
    assignments: rowsOrThrow<AssignmentDbRow>(assignments).map(mapAssignment),
    overrides: rowsOrThrow<OverrideDbRow>(overrides).map(mapOverride),
    alerts: rowsOrThrow<AlertDbRow>(alerts).map(mapAlert),
  };
}

export async function findEffectivePlanRows(salonId: string) {
  const supabase = billingDb();
  const [metrics, assignment, overrides] = await Promise.all([
    findActiveMetrics(),
    findCurrentAssignment(supabase, salonId),
    findActiveOverrides(supabase, salonId),
  ]);

  const plan = assignment ? await findPlanWithChildren(assignment.plan_id) : null;
  const usage = await calculateSalonUsage(supabase, salonId, metrics, plan, assignment);

  return { metrics, assignment, plan, overrides, usage };
}

export async function findAssignmentStartsAt(salonId: string): Promise<string | null> {
  const supabase = billingDb();
  const { data, error } = await supabase
    .from("salon_plan_assignments")
    .select("starts_at")
    .eq("salon_id", salonId)
    .maybeSingle();
  if (error) throw error;
  return data?.starts_at ?? null;
}

export async function findAssignmentForPayment(salonId: string): Promise<{
  plan_id: string;
  current_period_end: string | null;
} | null> {
  const supabase = billingDb();
  const { data, error } = await supabase
    .from("salon_plan_assignments")
    .select("plan_id, current_period_end")
    .eq("salon_id", salonId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findSalonPayments(salonId: string, limit = 12): Promise<PaymentRow[]> {
  const supabase = billingDb();
  const result = await supabase
    .from("salon_plan_payments")
    .select(PAYMENT_COLUMNS)
    .eq("salon_id", salonId)
    .order("paid_at", { ascending: false })
    .limit(limit);
  return rowsOrThrow(result);
}

export async function findOpenSalonAlerts(salonId: string): Promise<PlanAlert[]> {
  const supabase = billingDb();
  const result = await supabase
    .from("salon_plan_alerts")
    .select(ALERT_COLUMNS)
    .eq("salon_id", salonId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20);
  return rowsOrThrow<AlertDbRow>(result).map(mapAlert);
}

async function findCurrentAssignment(supabase: BillingDb, salonId: string): Promise<AssignmentRow | null> {
  const { data, error } = await supabase
    .from("salon_plan_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("salon_id", salonId)
    .in("status", ["trialing", "active", "past_due", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAssignment(data) : null;
}

async function findActiveOverrides(supabase: BillingDb, salonId: string): Promise<SalonPlanOverride[]> {
  const rows = rowsOrThrow<OverrideDbRow>(
    await supabase.from("salon_plan_overrides").select(OVERRIDE_COLUMNS).eq("salon_id", salonId)
  );
  const today = new Date().toISOString().slice(0, 10);
  return rows
    .map(mapOverride)
    .filter((row) =>
      row.status === "active" &&
      (!row.startsAt || row.startsAt <= today) &&
      (!row.endsAt || row.endsAt >= today)
    );
}
