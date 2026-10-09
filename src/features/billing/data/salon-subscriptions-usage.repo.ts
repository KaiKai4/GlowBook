import "server-only";

import type {
  CommercialLimitMetric,
  CommercialPlan,
  SalonPlanUsageByMetric,
} from "../domain/commercial-plan";
import { scopeWindow } from "../domain/usage-windows";
import type { UntypedSupabase } from "./billing-db";
import type { AssignmentRow } from "./salon-subscriptions.rows";

export async function calculateSalonUsage(
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
