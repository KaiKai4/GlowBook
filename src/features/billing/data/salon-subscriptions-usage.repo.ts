import "server-only";

import type { Json } from "@/types/database.types";
import type {
  CommercialLimitMetric,
  CommercialPlan,
  SalonPlanUsageByMetric,
} from "../domain/commercial-plan";
import { scopeWindow } from "../domain/usage-windows";
import type { BillingDb } from "./billing-db";
import type { AssignmentTenantRow } from "./salon-subscriptions.rows";

export async function calculateSalonUsage(
  supabase: BillingDb,
  salonId: string,
  metrics: CommercialLimitMetric[],
  plan: CommercialPlan | null,
  assignment: AssignmentTenantRow | null
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
  if (error) throw error;

  return Object.fromEntries(metrics.map((metric) => [metric.key, countFromRpc(data, metric.key)]));
}

/** Extrae el conteo de una clave del JSON devuelto por la RPC; ausente o no numérico cuenta como 0. */
function countFromRpc(data: Json, key: string): number {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return 0;
  return Number(data[key] ?? 0);
}
