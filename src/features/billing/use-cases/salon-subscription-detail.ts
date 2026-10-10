import "server-only";
import type { PlatformAdminProof } from "@/infra/auth/platform-admin-proof";
import { planLimitMessage } from "../messages";
import { roundCurrency } from "@/infra/format/money";
import { findCommercialAddons } from "../data/commercial-addons.repo";
import { findPlanCatalog } from "../data/commercial-plans.repo";
import {
  findEffectivePlanRowsForPlatform,
  findOpenSalonAlerts,
  findSalonPayments,
} from "../data/salon-subscriptions.repo";
import type {
  CommercialLimitMetric,
  CommercialPlan,
  EffectivePlanLimit,
  SalonPlanAssignmentStatus,
} from "../domain/commercial-plan";
import {
  buildSalonExtras,
  extraMonthlyPrice,
} from "../domain/salon-extras";
import {
  buildEffectiveLimits,
  extraDetail,
  isPlanAssignmentActive,
  manualExtraName,
  resolveEnabledModules,
  type EnabledModuleKey,
} from "../domain/salon-plan-views";

export interface SalonExtraView {
  id: string;
  name: string;
  detail: string;
  quantity: number;
  isGift: boolean;
  monthlyPrice: number;
  endsAt: string | null;
  reason: string;
}

interface SalonPaymentView {
  id: string;
  amount: number;
  currency: string;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  notes: string;
}

interface SalonAlertView {
  id: string;
  severity: "info" | "warning" | "danger";
  message: string;
  createdAt: string;
}

/** Límite con su texto visible ya resuelto (la vista no recibe códigos). */
type SalonPlanLimitView = EffectivePlanLimit & { message: string };

export interface SalonSubscriptionDetail {
  salonId: string;
  assignment: {
    planId: string;
    status: SalonPlanAssignmentStatus;
    startsAt: string | null;
    endsAt: string | null;
    trialEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    notes: string;
  } | null;
  plan: CommercialPlan | null;
  enabledModules: EnabledModuleKey[];
  limits: SalonPlanLimitView[];
  extras: SalonExtraView[];
  payments: SalonPaymentView[];
  openAlerts: SalonAlertView[];
  planPrice: number;
  extrasPrice: number;
  monthlyTotal: number;
}

/** Añade el texto visible de un límite a partir de su código de dominio. */
function withLimitMessage(limit: EffectivePlanLimit): SalonPlanLimitView {
  return {
    ...limit,
    message: planLimitMessage(limit.messageCode, {
      metricName: limit.metric.name,
      used: limit.used,
      maxValue: limit.maxValue,
    }),
  };
}

export async function getSalonSubscriptionDetail(
  proof: PlatformAdminProof,
  salonId: string
): Promise<SalonSubscriptionDetail> {
  const [rows, addons, modules, payments, openAlerts] = await Promise.all([
    findEffectivePlanRowsForPlatform(proof, salonId),
    findCommercialAddons(proof),
    findPlanCatalog(proof).then((catalog) => catalog.modules),
    findSalonPayments(proof, salonId),
    findOpenSalonAlerts(proof, salonId),
  ]);

  // Mismo criterio que getEffectiveSalonPlan: un plan pausado/cancelado no da módulos ni límites.
  const plan = isPlanAssignmentActive(rows.assignment?.status) ? rows.plan : null;
  const enabled = resolveEnabledModules(plan, rows.overrides);
  const extras = buildSalonExtras(rows.overrides, addons);
  const moduleByKey = new Map(modules.map((module) => [module.key, module.name]));
  const metricByKey = new Map<string, CommercialLimitMetric>(rows.metrics.map((metric) => [metric.key, metric]));

  const extrasViews = extras.map(({ override, addon }) => ({
    id: override.id,
    name: addon?.name ?? manualExtraName(override, moduleByKey, metricByKey),
    detail: extraDetail(override, addon, metricByKey),
    quantity: override.quantity,
    isGift: override.isGift,
    monthlyPrice: extraMonthlyPrice(override, addon),
    endsAt: override.endsAt,
    reason: override.reason,
  }));

  const planPrice = plan ? plan.monthlyPrice : 0;
  const extrasPrice = roundCurrency(extrasViews.reduce((total, extra) => total + extra.monthlyPrice, 0));

  return {
    salonId,
    assignment: rows.assignment
      ? {
          planId: rows.assignment.plan_id,
          status: rows.assignment.status,
          startsAt: rows.assignment.starts_at,
          endsAt: rows.assignment.ends_at,
          trialEndsAt: rows.assignment.trial_ends_at,
          currentPeriodStart: rows.assignment.current_period_start,
          currentPeriodEnd: rows.assignment.current_period_end,
          notes: rows.assignment.notes,
        }
      : null,
    plan,
    enabledModules: Array.from(enabled),
    limits: buildEffectiveLimits(plan, rows.metrics, rows.overrides, rows.usage, enabled).map(withLimitMessage),
    extras: extrasViews,
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      paidAt: payment.paid_at,
      periodStart: payment.period_start,
      periodEnd: payment.period_end,
      notes: payment.notes,
    })),
    openAlerts: openAlerts.map((alert) => ({
      id: alert.id,
      severity: alert.severity,
      message: alert.message,
      createdAt: alert.created_at,
    })),
    planPrice,
    extrasPrice,
    monthlyTotal: roundCurrency(planPrice + extrasPrice),
  };
}
