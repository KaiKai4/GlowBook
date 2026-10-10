import "server-only";

import type { CommercialLimitMetric, PlanRuleOverride, SalonPlanOverride } from "../domain/commercial-plan";
import type { PlatformAdminProof } from "@/infra/auth/platform-admin-proof";
import { billingSalonDb, platformDb, rowsOrThrow, type BillingDb } from "./billing-db";
import { findActiveMetrics, loadPlanWithChildren } from "./commercial-plans.repo";
import { calculateSalonUsage } from "./salon-subscriptions-usage.repo";
import {
  ALERT_COLUMNS,
  ASSIGNMENT_COLUMNS,
  ASSIGNMENT_TENANT_COLUMNS,
  OVERRIDE_COLUMNS,
  OVERRIDE_TENANT_COLUMNS,
  PAYMENT_COLUMNS,
  mapAlert,
  mapAssignment,
  mapOverride,
  mapTenantAssignment,
  mapTenantOverride,
  type AlertDbRow,
  type AssignmentDbRow,

  type AssignmentTenantRow,
  type AssignmentRow,
  type OverrideDbRow,
  type OverrideTenantDbRow,
  type PaymentRow,
  type PlanAlert,
} from "./salon-subscriptions.rows";

/** Pagos mostrados en el historial del salón. */
const PAYMENT_HISTORY_LIMIT = 12;

// Lecturas de suscripción. Cada función elige su cliente (ver billing-db.ts):
//   - ...ForPlatform: service_role y columnas completas (panel /admin).
//   - ...ForSalon: cliente del usuario (RLS) y columnas concedidas al salón.

export async function findSubscriptionRows(proof: PlatformAdminProof) {
  const supabase = platformDb(proof);
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

/** Plan efectivo para plataforma (service_role, columnas completas). */
export async function findEffectivePlanRowsForPlatform(proof: PlatformAdminProof, salonId: string) {
  const supabase = platformDb(proof);
  const [metrics, assignment, overrides] = await Promise.all([
    findActiveMetrics(supabase),
    findCurrentAssignment(supabase, salonId),
    findActiveOverrides(supabase, salonId),
  ]);
  return finishEffectivePlan(supabase, salonId, metrics, assignment, overrides);
}

/** Plan efectivo leído por el propio salón con su sesión (RLS). Sin notas, motivos ni precios especiales. */
export async function findEffectivePlanRowsForSalon(salonId: string) {
  const supabase = await billingSalonDb();
  const [metrics, assignment, overrides] = await Promise.all([
    findActiveMetrics(supabase),
    findCurrentTenantAssignment(supabase, salonId),
    findActiveTenantOverrides(supabase, salonId),
  ]);
  return finishEffectivePlan(supabase, salonId, metrics, assignment, overrides);
}

export async function findAssignmentStartsAt(proof: PlatformAdminProof, salonId: string): Promise<string | null> {
  const supabase = platformDb(proof);
  const { data, error } = await supabase
    .from("salon_plan_assignments")
    .select("starts_at")
    .eq("salon_id", salonId)
    .maybeSingle();
  if (error) throw error;
  return data?.starts_at ?? null;
}

export async function findAssignmentForPayment(proof: PlatformAdminProof, salonId: string): Promise<{
  plan_id: string;
  current_period_end: string | null;
} | null> {
  const supabase = platformDb(proof);
  const { data, error } = await supabase
    .from("salon_plan_assignments")
    .select("plan_id, current_period_end")
    .eq("salon_id", salonId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findSalonPayments(proof: PlatformAdminProof, salonId: string, limit = PAYMENT_HISTORY_LIMIT): Promise<PaymentRow[]> {
  const supabase = platformDb(proof);
  const result = await supabase
    .from("salon_plan_payments")
    .select(PAYMENT_COLUMNS)
    .eq("salon_id", salonId)
    .order("paid_at", { ascending: false })
    .limit(limit);
  return rowsOrThrow(result);
}

export async function findOpenSalonAlerts(proof: PlatformAdminProof, salonId: string): Promise<PlanAlert[]> {
  const supabase = platformDb(proof);
  const result = await supabase
    .from("salon_plan_alerts")
    .select(ALERT_COLUMNS)
    .eq("salon_id", salonId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20);
  return rowsOrThrow<AlertDbRow>(result).map(mapAlert);
}

/** Cálculo común: plan con hijos (con el mismo cliente) y uso por métrica. */
async function finishEffectivePlan<A extends AssignmentTenantRow, O extends PlanRuleOverride>(
  supabase: BillingDb,
  salonId: string,
  metrics: CommercialLimitMetric[],
  assignment: A | null,
  overrides: O[]
) {
  const plan = assignment ? await loadPlanWithChildren(supabase, assignment.plan_id) : null;
  const usage = await calculateSalonUsage(supabase, salonId, metrics, plan, assignment);
  return { metrics, assignment, plan, overrides, usage };
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

async function findCurrentTenantAssignment(supabase: BillingDb, salonId: string): Promise<AssignmentTenantRow | null> {
  const { data, error } = await supabase
    .from("salon_plan_assignments")
    .select(ASSIGNMENT_TENANT_COLUMNS)
    .eq("salon_id", salonId)
    .in("status", ["trialing", "active", "past_due", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTenantAssignment(data) : null;
}

async function findActiveOverrides(supabase: BillingDb, salonId: string): Promise<SalonPlanOverride[]> {
  const rows = rowsOrThrow<OverrideDbRow>(
    await supabase.from("salon_plan_overrides").select(OVERRIDE_COLUMNS).eq("salon_id", salonId)
  );
  return keepOverridesActiveToday(rows.map(mapOverride));
}

async function findActiveTenantOverrides(supabase: BillingDb, salonId: string): Promise<PlanRuleOverride[]> {
  const rows = rowsOrThrow<OverrideTenantDbRow>(
    await supabase.from("salon_plan_overrides").select(OVERRIDE_TENANT_COLUMNS).eq("salon_id", salonId)
  );
  return keepOverridesActiveToday(rows.map(mapTenantOverride));
}

/** Overrides activos hoy: estado active y dentro de su ventana de fechas (si la tienen). */
function keepOverridesActiveToday<O extends PlanRuleOverride>(rows: O[]): O[] {
  const today = new Date().toISOString().slice(0, 10);
  return rows.filter((row) =>
    row.status === "active" &&
    (!row.startsAt || row.startsAt <= today) &&
    (!row.endsAt || row.endsAt >= today)
  );
}
