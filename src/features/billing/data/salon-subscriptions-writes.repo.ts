import "server-only";

import type {
  PlanEnforcementMode,
  SalonPlanAssignmentStatus,
} from "../domain/commercial-plan";
import { billingDb, billingSalonDb, countOrThrow, expectOneUpdatedRow, throwOnError } from "./billing-db";

// Escrituras de suscripción. Las de plataforma usan service_role y filtran por salon_id;
// las del salón (alertas) usan el cliente del usuario y la RLS / RPC con su sesión.

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

/** Cambia el estado de un override del salón indicado; debe afectar exactamente una fila. */
export async function updateSalonPlanOverrideStatus(
  salonId: string,
  overrideId: string,
  status: "active" | "paused" | "canceled"
) {
  const supabase = billingDb();
  expectOneUpdatedRow(
    await supabase
      .from("salon_plan_overrides")
      .update({ status })
      .eq("id", overrideId)
      .eq("salon_id", salonId)
      .select("id"),
    "extra del plan"
  );
}

/**
 * Crea una alerta de plan para el salón de la sesión mediante la RPC record_plan_alert
 * (security definer). El salón se toma del claim de la sesión, no de un parámetro.
 */
export async function recordPlanAlert(values: {
  planId: string;
  metricKey: string;
  moduleKey: string;
  severity: "info" | "warning" | "danger";
  message: string;
}) {
  const supabase = await billingSalonDb();
  throwOnError(
    await supabase.rpc("record_plan_alert", {
      p_plan_id: values.planId,
      p_metric_key: values.metricKey,
      p_module_key: values.moduleKey,
      p_severity: values.severity,
      p_message: values.message,
    })
  );
}

/** Marca una alerta como resuelta dentro del salón indicado; debe afectar exactamente una fila. */
export async function resolvePlanAlert(salonId: string, alertId: string) {
  const supabase = billingDb();
  expectOneUpdatedRow(
    await supabase
      .from("salon_plan_alerts")
      .update({ status: "resolved" })
      .eq("id", alertId)
      .eq("salon_id", salonId)
      .select("id"),
    "alerta del plan"
  );
}

/** Indica si el salón de la sesión ya tiene una alerta abierta para esa métrica (RLS). */
export async function hasOpenPlanAlert(salonId: string, metricKey: string): Promise<boolean> {
  const supabase = await billingSalonDb();
  const count = await supabase
    .from("salon_plan_alerts")
    .select("id", { count: "exact", head: true })
    .eq("salon_id", salonId)
    .eq("metric_key", metricKey)
    .eq("status", "open");
  return countOrThrow(count) > 0;
}
