import type { CommercialPlan, SalonPlanAssignmentStatus } from "./commercial-plan";
import { roundCurrency } from "@/infra/format/money";

export interface SalonSubscriptionRow {
  salonId: string;
  salonName: string;
  salonIsActive: boolean;
  planId: string | null;
  planName: string | null;
  planPrice: number;
  currency: string;
  status: SalonPlanAssignmentStatus | null;
  trialEndsAt: string | null;
  extrasCount: number;
  extrasPrice: number;
  monthlyTotal: number;
  openAlertCount: number;
}

/** Fila de una suscripción de salón: precio del plan solo si la asignación factura. */
export function buildSubscriptionRow(input: {
  salon: { id: string; name: string; is_active: boolean };
  assignment: { status: SalonPlanAssignmentStatus; trial_ends_at: string | null } | null;
  plan: CommercialPlan | null;
  extras: { monthlyPrice: number }[];
  openAlertCount: number;
}): SalonSubscriptionRow {
  const { salon, assignment, plan, extras, openAlertCount } = input;
  const billable = assignment?.status === "active" || assignment?.status === "trialing" || assignment?.status === "past_due";
  const extrasPrice = roundCurrency(extras.reduce((total, extra) => total + extra.monthlyPrice, 0));
  const planPrice = billable && plan ? plan.monthlyPrice : 0;

  return {
    salonId: salon.id,
    salonName: salon.name,
    salonIsActive: salon.is_active,
    planId: plan?.id ?? null,
    planName: plan?.name ?? null,
    planPrice,
    currency: plan?.currency ?? "USD",
    status: assignment?.status ?? null,
    trialEndsAt: assignment?.trial_ends_at ?? null,
    extrasCount: extras.length,
    extrasPrice,
    monthlyTotal: roundCurrency(planPrice + extrasPrice),
    openAlertCount,
  };
}

/** MRR: suma del total mensual de las filas con asignación activa. */
export function subscriptionMrr(rows: SalonSubscriptionRow[]): number {
  return roundCurrency(
    rows
      .filter((row) => row.status === "active")
      .reduce((total, row) => total + row.monthlyTotal, 0)
  );
}
