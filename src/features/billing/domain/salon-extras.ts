import type { SalonFeatureKey } from "@/features/salon-features";
import type { PlanEnforcementMode, SalonPlanOverride } from "./commercial-plan";

export const COMMERCIAL_ADDON_KINDS = ["module", "limit_boost"] as const;
export const COMMERCIAL_ADDON_STATUSES = ["draft", "active", "archived"] as const;

export type CommercialAddonKind = (typeof COMMERCIAL_ADDON_KINDS)[number];
export type CommercialAddonStatus = (typeof COMMERCIAL_ADDON_STATUSES)[number];

export interface CommercialAddon {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: CommercialAddonKind;
  moduleKey: SalonFeatureKey | null;
  metricKey: string | null;
  limitDelta: number | null;
  currency: string;
  monthlyPrice: number;
  status: CommercialAddonStatus;
  sortOrder: number;
}

export interface SalonExtra {
  override: SalonPlanOverride;
  addon: CommercialAddon | null;
  monthlyPrice: number;
}

export function extraMonthlyPrice(
  override: Pick<SalonPlanOverride, "isGift" | "priceOverride" | "quantity">,
  addon: Pick<CommercialAddon, "monthlyPrice"> | null
): number {
  if (override.isGift) return 0;
  const unitPrice = override.priceOverride ?? addon?.monthlyPrice ?? 0;
  return roundMoney(unitPrice * override.quantity);
}

export function buildSalonExtras(
  overrides: SalonPlanOverride[],
  addons: CommercialAddon[]
): SalonExtra[] {
  const addonById = new Map(addons.map((addon) => [addon.id, addon]));
  return overrides.map((override) => {
    const addon = override.addonId ? addonById.get(override.addonId) ?? null : null;
    return { override, addon, monthlyPrice: extraMonthlyPrice(override, addon) };
  });
}

export function resolveOverrideMax(
  base: number | null,
  overrides: SalonPlanOverride[]
): number | null {
  const replacement = overrides.find((item) => item.maxOverride !== null);
  if (replacement?.maxOverride !== null && replacement?.maxOverride !== undefined) {
    return replacement.maxOverride;
  }
  return overrides.reduce((current, item) => {
    if (current === null) return current;
    return current + (item.maxDelta ?? 0) * item.quantity;
  }, base);
}

export function resolveOverrideMode(
  base: PlanEnforcementMode,
  overrides: SalonPlanOverride[]
): PlanEnforcementMode {
  return overrides.find((item) => item.enforcementMode)?.enforcementMode ?? base;
}

export function resolveOverrideThreshold(
  base: number,
  overrides: SalonPlanOverride[]
): number {
  return overrides.find((item) => item.warningThreshold !== null)?.warningThreshold ?? base;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
