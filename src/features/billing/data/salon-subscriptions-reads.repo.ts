import "server-only";

import type { SalonPlanOverride } from "../domain/commercial-plan";
import {
  billingDb,
  selectRows,
  selectWhere,
  type UntypedSupabase,
} from "./billing-db";
import { findPlanWithChildren, findActiveMetrics } from "./commercial-plans.repo";
import { calculateSalonUsage } from "./salon-subscriptions-usage.repo";
import {
  ALERT_COLUMNS,
  ASSIGNMENT_COLUMNS,
  OVERRIDE_COLUMNS,
  mapOverride,
  type AssignmentRow,
  type OverrideRow,
  type PaymentRow,
  type PlanAlert,
} from "./salon-subscriptions.rows";

export async function findSubscriptionRows() {
  const supabase = billingDb();
  const [assignments, overrides, alerts] = await Promise.all([
    selectRows<AssignmentRow>(supabase, "salon_plan_assignments", ASSIGNMENT_COLUMNS, "created_at"),
    selectRows<OverrideRow>(supabase, "salon_plan_overrides", OVERRIDE_COLUMNS, "created_at"),
    selectRows<PlanAlert>(supabase, "salon_plan_alerts", ALERT_COLUMNS, "created_at"),
  ]);
  return { assignments, overrides: overrides.map(mapOverride), alerts };
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
    .maybeSingle<{ starts_at: string | null }>();
  if (error) throw new Error(error.message);
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
    .maybeSingle<{ plan_id: string; current_period_end: string | null }>();
  if (error) throw new Error(error.message);
  return data;
}

export async function findSalonPayments(salonId: string, limit = 12): Promise<PaymentRow[]> {
  const supabase = billingDb();
  const { data, error } = await supabase
    .from("salon_plan_payments")
    .select("id, salon_id, plan_id, amount, currency, paid_at, period_start, period_end, notes")
    .eq("salon_id", salonId)
    .order("paid_at", { ascending: false })
    .limit(limit)
    .then((result) => result as { data: PaymentRow[] | null; error: { message: string } | null });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findOpenSalonAlerts(salonId: string): Promise<PlanAlert[]> {
  const supabase = billingDb();
  const { data, error } = await supabase
    .from("salon_plan_alerts")
    .select(ALERT_COLUMNS)
    .eq("salon_id", salonId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20)
    .then((result) => result as { data: PlanAlert[] | null; error: { message: string } | null });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function findCurrentAssignment(
  supabase: UntypedSupabase,
  salonId: string
): Promise<AssignmentRow | null> {
  const { data, error } = await supabase
    .from("salon_plan_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("salon_id", salonId)
    .in("status", ["trialing", "active", "past_due", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AssignmentRow>();
  if (error) throw new Error(error.message);
  return data;
}

async function findActiveOverrides(
  supabase: UntypedSupabase,
  salonId: string
): Promise<SalonPlanOverride[]> {
  const rows = await selectWhere<OverrideRow>(
    supabase,
    "salon_plan_overrides",
    OVERRIDE_COLUMNS,
    "salon_id",
    salonId
  );
  const today = new Date().toISOString().slice(0, 10);
  return rows
    .filter((row) =>
      row.status === "active" &&
      (!row.starts_at || row.starts_at <= today) &&
      (!row.ends_at || row.ends_at >= today)
    )
    .map(mapOverride);
}
