import "server-only";

import type { Database } from "@/types/database.types";
import type { CommercialAddon, CommercialAddonKind, CommercialAddonStatus } from "../domain/salon-extras";
import { parseAddonKind, parseAddonStatus, parseFeatureKey } from "./billing-enums";
import { billingDb, countOrThrow, rowsOrThrow, throwOnError } from "./billing-db";

const ADDON_COLUMNS =
  "id, code, name, description, kind, module_key, metric_key, limit_delta, currency, monthly_price, status, sort_order";

type AddonDbRow = Pick<
  Database["public"]["Tables"]["commercial_addons"]["Row"],
  | "id"
  | "code"
  | "name"
  | "description"
  | "kind"
  | "module_key"
  | "metric_key"
  | "limit_delta"
  | "currency"
  | "monthly_price"
  | "status"
  | "sort_order"
>;

function mapAddon(row: AddonDbRow): CommercialAddon {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    kind: parseAddonKind(row.kind),
    moduleKey: row.module_key === null ? null : parseFeatureKey(row.module_key, "commercial_addons.module_key"),
    metricKey: row.metric_key,
    limitDelta: row.limit_delta,
    currency: row.currency,
    monthlyPrice: Number(row.monthly_price),
    status: parseAddonStatus(row.status),
    sortOrder: row.sort_order,
  };
}

export async function findCommercialAddons(): Promise<CommercialAddon[]> {
  const supabase = billingDb();
  const rows = await supabase.from("commercial_addons").select(ADDON_COLUMNS).order("sort_order", { ascending: true });
  return rowsOrThrow<AddonDbRow>(rows).map(mapAddon);
}

export async function findCommercialAddonById(addonId: string): Promise<CommercialAddon | null> {
  const supabase = billingDb();
  const { data, error } = await supabase
    .from("commercial_addons")
    .select(ADDON_COLUMNS)
    .eq("id", addonId)
    .maybeSingle();
  if (error) throw error;
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
    throwOnError(await supabase.from("commercial_addons").update(payload).eq("id", values.id));
    return values.id;
  }

  const { data, error } = await supabase.from("commercial_addons").insert(payload).select("id").single();
  if (error) throw error;
  if (!data) throw new Error("No se pudo crear el extra.");
  return data.id;
}

export async function archiveCommercialAddon(addonId: string): Promise<void> {
  const supabase = billingDb();
  throwOnError(await supabase.from("commercial_addons").update({ status: "archived" }).eq("id", addonId));
}

export async function deleteCommercialAddon(addonId: string): Promise<void> {
  const supabase = billingDb();
  throwOnError(await supabase.from("commercial_addons").delete().eq("id", addonId));
}

export async function countAddonAssignments(addonId: string): Promise<number> {
  const supabase = billingDb();
  return countOrThrow(
    await supabase
      .from("salon_plan_overrides")
      .select("*", { count: "exact", head: true })
      .eq("addon_id", addonId)
  );
}
