"use client";

import { useState } from "react";
import type { CommercialPlan } from "@/features/billing/use-cases/commercial-plans";
import { addDays, todayIso } from "@/features/billing/domain/assignment-schedule";
import type { SalonSubscriptionDetail } from "@/features/billing/use-cases/salon-subscription-detail";

export type SubscriptionAssignment = SalonSubscriptionDetail["assignment"];

/**
 * Estado del formulario de asignación de plan. Las fechas se calculan solas:
 * el inicio se conserva si ya existe y el fin del trial sale de los días del plan.
 */
export function useAssignPlanState(assignment: SubscriptionAssignment, plans: CommercialPlan[]) {
  const [planId, setPlanId] = useState(assignment?.planId ?? "");
  const [status, setStatus] = useState<string>(assignment?.status ?? "trialing");
  const [showEnds, setShowEnds] = useState(Boolean(assignment?.endsAt));

  const selectedPlan = plans.find((plan) => plan.id === planId) ?? null;
  const startsAt = assignment?.startsAt ?? todayIso();
  const trialEndsAt =
    status === "trialing" && selectedPlan && selectedPlan.trialDays > 0
      ? addDays(startsAt, selectedPlan.trialDays)
      : null;

  return {
    planId,
    setPlanId,
    status,
    setStatus,
    showEnds,
    showEndsField: () => setShowEnds(true),
    selectedPlan,
    startsAt,
    trialEndsAt,
    hasExistingStart: Boolean(assignment?.startsAt),
  };
}
