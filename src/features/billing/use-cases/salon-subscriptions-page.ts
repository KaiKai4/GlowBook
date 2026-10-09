import "server-only";
import { findCommercialAddons } from "../data/commercial-addons.repo";
import { findPlanCatalog } from "../data/commercial-plans.repo";
import { findSubscriptionRows } from "../data/salon-subscriptions.repo";
import type { CommercialLimitMetric, CommercialPlan } from "../domain/commercial-plan";
import type { CommercialAddon } from "../domain/salon-extras";
import { buildSalonExtras } from "../domain/salon-extras";
import {
  buildSubscriptionRow,
  subscriptionMrr,
  type SalonSubscriptionRow,
} from "../domain/salon-subscription-rows";
import type { EnabledModuleKey } from "../domain/salon-plan-views";

export interface SubscriptionsPageData {
  rows: SalonSubscriptionRow[];
  plans: CommercialPlan[];
  addons: CommercialAddon[];
  metrics: CommercialLimitMetric[];
  modules: { key: EnabledModuleKey; name: string }[];
  totals: {
    mrr: number;
    salonsWithPlan: number;
    trialing: number;
    openAlerts: number;
  };
}

export async function getSubscriptionsPage(
  salons: Array<{ id: string; name: string; is_active: boolean }>
): Promise<SubscriptionsPageData> {
  const [catalog, addons, subscription] = await Promise.all([
    findPlanCatalog(),
    findCommercialAddons(),
    findSubscriptionRows(),
  ]);

  const planById = new Map(catalog.plans.map((plan) => [plan.id, plan]));
  const assignmentBySalon = new Map(subscription.assignments.map((row) => [row.salon_id, row]));
  const extras = buildSalonExtras(subscription.overrides, addons);

  const rows = salons.map((salon) => {
    const assignment = assignmentBySalon.get(salon.id);
    const plan = assignment ? planById.get(assignment.plan_id) ?? null : null;
    const salonExtras = extras.filter(
      (extra) => extra.override.salonId === salon.id && extra.override.status === "active"
    );
    const openAlertCount = subscription.alerts.filter(
      (alert) => alert.salon_id === salon.id && alert.status === "open"
    ).length;

    return buildSubscriptionRow({
      salon,
      assignment: assignment ?? null,
      plan,
      extras: salonExtras,
      openAlertCount,
    });
  });

  return {
    rows,
    plans: catalog.plans.filter((plan) => plan.status === "active"),
    addons: addons.filter((addon) => addon.status === "active"),
    metrics: catalog.metrics.filter((metric) => metric.isActive && !metric.isArchived),
    modules: catalog.modules
      .filter((module) => module.isActive && !module.isArchived)
      .map((module) => ({ key: module.key, name: module.name })),
    totals: {
      mrr: subscriptionMrr(rows),
      salonsWithPlan: rows.filter((row) => row.planId !== null).length,
      trialing: rows.filter((row) => row.status === "trialing").length,
      openAlerts: rows.reduce((total, row) => total + row.openAlertCount, 0),
    },
  };
}
