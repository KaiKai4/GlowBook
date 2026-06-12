import "server-only";

import type { SalonFeatureKey } from "@/features/salon/domain/salon-features";
import type {
  CommercialLimitMetric,
  CommercialPlan,
  PlanEnforcementMode,
  PlanLimitCountScope,
  SalonPlanAssignmentStatus,
  SalonPlanOverride,
  SalonPlanUsageByMetric,
} from "../domain/commercial-plan";
import {
  billingDb,
  countRows,
  assertOk,
  selectRows,
  selectWhere,
  type UntypedSupabase,
} from "./billing-db";
import { findPlanWithChildren, findActiveMetrics } from "./commercial-plans.repo";

const ASSIGNMENT_COLUMNS =
  "id, salon_id, plan_id, status, starts_at, ends_at, trial_ends_at, current_period_start, current_period_end, notes";
const OVERRIDE_COLUMNS =
  "id, salon_id, module_key, metric_key, module_enabled, max_delta, max_override, enforcement_mode, warning_threshold, reason, starts_at, ends_at, status, addon_id, quantity, is_gift, price_override";
const ALERT_COLUMNS = "id, salon_id, plan_id, metric_key, module_key, severity, message, status, created_at";

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

interface OverrideRow {
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
    moduleKey: row.module_key as SalonFeatureKey | null,
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
  await assertOk(
    supabase.from("salon_plan_payments").insert({
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
  await assertOk(
    supabase
      .from("salon_plan_assignments")
      .update({
        status: "active",
        current_period_start: values.periodStart,
        current_period_end: values.periodEnd,
      })
      .eq("salon_id", values.salonId)
  );
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
  await assertOk(
    supabase.from("salon_plan_assignments").upsert({
      salon_id: values.salonId,
      plan_id: values.planId,
      status: values.status,
      starts_at: values.startsAt,
      ends_at: values.endsAt,
      trial_ends_at: values.trialEndsAt,
      notes: values.notes,
    }, { onConflict: "salon_id" })
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
  await assertOk(
    supabase.from("salon_plan_overrides").insert({
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
  await assertOk(supabase.from("salon_plan_overrides").update({ status }).eq("id", overrideId));
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
  await assertOk(
    supabase.from("salon_plan_alerts").insert({
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
  await assertOk(supabase.from("salon_plan_alerts").update({ status: "resolved" }).eq("id", alertId));
}

export async function hasOpenPlanAlert(salonId: string, metricKey: string): Promise<boolean> {
  const supabase = billingDb();
  const count = await countRows(
    supabase
      .from("salon_plan_alerts")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salonId)
      .eq("metric_key", metricKey)
      .eq("status", "open")
  );
  return count > 0;
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

// Las ventanas de ciclo se calculan aqui (logica de negocio con casos como el
// periodo pagado o el dia ancla); la RPC count_salon_usage solo ejecuta todos
// los counts en un unico round-trip a la base.
async function calculateSalonUsage(
  supabase: UntypedSupabase,
  salonId: string,
  metrics: CommercialLimitMetric[],
  plan: CommercialPlan | null,
  assignment: AssignmentRow | null
): Promise<SalonPlanUsageByMetric> {
  if (metrics.length === 0) return {};

  const scopeByMetric = new Map(metrics.map((metric) => [metric.key, metric.defaultCountScope]));
  for (const limit of plan?.limits ?? []) {
    scopeByMetric.set(limit.metricKey, limit.countScope);
  }

  const counters = metrics.map((metric) => {
    const scope = scopeByMetric.get(metric.key) ?? metric.defaultCountScope;
    const [from, to] = scopeWindow(scope, assignment);
    return { key: metric.key, counter: metric.counterKey, from, to };
  });

  const { data, error } = await supabase.rpc("count_salon_usage", {
    p_salon_id: salonId,
    p_counters: counters,
  });
  if (error) throw new Error(error.message);

  const counts = (data ?? {}) as Record<string, number>;
  return Object.fromEntries(metrics.map((metric) => [metric.key, Number(counts[metric.key] ?? 0)]));
}

function scopeWindow(
  scope: PlanLimitCountScope,
  assignment: AssignmentRow | null
): [string | null, string | null] {
  if (scope === "current" || scope === "lifetime") return [null, null];
  return scope === "billing_cycle" ? billingCycleWindow(assignment) : currentMonthWindow();
}

function currentMonthWindow(): [string, string] {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return [from.toISOString(), to.toISOString()];
}

function billingCycleWindow(assignment: AssignmentRow | null): [string, string] {
  // El periodo pagado manda: si la plataforma registro un pago, el ciclo de
  // consumo corre exactamente con ese mes de uso.
  if (assignment?.current_period_start && assignment.current_period_end) {
    return [
      `${assignment.current_period_start}T00:00:00.000Z`,
      `${assignment.current_period_end}T00:00:00.000Z`,
    ];
  }
  return anchoredCycleWindow(assignment?.starts_at ?? null);
}

function anchoredCycleWindow(startsAt: string | null): [string, string] {
  if (!startsAt) return currentMonthWindow();

  const now = new Date();
  const anchor = new Date(`${startsAt}T00:00:00.000Z`);
  const cycleDay = anchor.getUTCDate();
  let from = clampedUtcDate(now.getUTCFullYear(), now.getUTCMonth(), cycleDay);

  if (from.getTime() > now.getTime()) {
    from = clampedUtcDate(now.getUTCFullYear(), now.getUTCMonth() - 1, cycleDay);
  }

  const to = clampedUtcDate(from.getUTCFullYear(), from.getUTCMonth() + 1, cycleDay);
  return [from.toISOString(), to.toISOString()];
}

function clampedUtcDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}
