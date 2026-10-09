import "server-only";

import type { SalonFeatureKey } from "@/features/salon-features";
import type {
  CommercialAddon,
  CommercialAddonKind,
  CommercialAddonStatus,
} from "../domain/salon-extras";
import { assertOk, billingDb, selectRows } from "./billing-db";

const ADDON_COLUMNS =
  "id, code, name, description, kind, module_key, metric_key, limit_delta, currency, monthly_price, status, sort_order";

interface AddonRow {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: CommercialAddonKind;
  module_key: string | null;
  metric_key: string | null;
  limit_delta: number | null;
  currency: string;
  monthly_price: number | string;
  status: CommercialAddonStatus;
  sort_order: number;
}

function mapAddon(row: AddonRow): CommercialAddon {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    kind: row.kind,
    moduleKey: row.module_key as SalonFeatureKey | null,
    metricKey: row.metric_key,
    limitDelta: row.limit_delta,
    currency: row.currency,
    monthlyPrice: Number(row.monthly_price),
    status: row.status,
    sortOrder: row.sort_order,
  };
}

export async function findCommercialAddons(): Promise<CommercialAddon[]> {
  const supabase = billingDb();
  const rows = await selectRows<AddonRow>(supabase, "commercial_addons", ADDON_COLUMNS, "sort_order");
  return rows.map(mapAddon);
}

export async function findCommercialAddonById(addonId: string): Promise<CommercialAddon | null> {
  const supabase = billingDb();
  const { data, error } = await supabase
    .from("commercial_addons")
    .select(ADDON_COLUMNS)
    .eq("id", addonId)
    .maybeSingle<AddonRow>();
  if (error) throw new Error(error.message);
  return data ? mapAddon(data) : null;
}

export async function saveCommercialAddon(values: {
  id?: string;
  code: string;
  name: string;
  description: string;
  kind: CommercialAddonKind;
  moduleKey: string | null;
  metricKey: string | null;
  limitDelta: number | null;
  currency: string;
  monthlyPrice: number;
  status: CommercialAddonStatus;
  sortOrder: number;
}): Promise<string> {
  const supabase = billingDb();
  const payload = {
    code: values.code,
    name: values.name,
    description: values.description,
    kind: values.kind,
    module_key: values.moduleKey,
    metric_key: values.metricKey,
    limit_delta: values.limitDelta,
    currency: values.currency,
    monthly_price: values.monthlyPrice,
    status: values.status,
    sort_order: values.sortOrder,
  };

  if (values.id) {
    await assertOk(supabase.from("commercial_addons").update(payload).eq("id", values.id));
    return values.id;
  }

  const { data, error } = await supabase
    .from("commercial_addons")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No se pudo crear el extra.");
  return data.id;
}

export async function archiveCommercialAddon(addonId: string): Promise<void> {
  const supabase = billingDb();
  await assertOk(supabase.from("commercial_addons").update({ status: "archived" }).eq("id", addonId));
}

export async function deleteCommercialAddon(addonId: string): Promise<void> {
  const supabase = billingDb();
  await assertOk(supabase.from("commercial_addons").delete().eq("id", addonId));
}

export async function countAddonAssignments(addonId: string): Promise<number> {
  const supabase = billingDb();
  const { count, error } = await supabase
    .from("salon_plan_overrides")
    .select("*", { count: "exact", head: true })
    .eq("addon_id", addonId)
    .then((result) => result as { count: number | null; error: { message: string } | null });
  if (error) throw new Error(error.message);
  return count ?? 0;
}
