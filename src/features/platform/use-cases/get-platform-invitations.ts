import "server-only";

import {
  findPendingInvitations,
  findRecentAcceptedInvitations,
} from "@/features/platform/data/invitations.repo";
import { getPlanCatalogSummary } from "@/features/billing/use-cases/commercial-plans";
import { findSalonNamesByIds } from "@/features/platform/data/salons.repo";

export interface PlatformInvitationViewModel {
  id: string;
  email: string;
  token: string;
  planName: string | null;
  createdAtLabel: string;
  expiresAtLabel: string;
  expired: boolean;
}

export interface AcceptedInvitationViewModel {
  id: string;
  email: string;
  salonName: string;
  planName: string | null;
  acceptedAtLabel: string;
}

export interface PlatformInvitationsViewModel {
  pendingInvitations: PlatformInvitationViewModel[];
  acceptedInvitations: AcceptedInvitationViewModel[];
  assignablePlans: Array<{ id: string; name: string; priceLabel: string; trialDays: number }>;
  pendingCount: number;
  expiredCount: number;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-PA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function getPlatformInvitations(): Promise<PlatformInvitationsViewModel> {
  const now = Date.now();
  const [pending, accepted, plans] = await Promise.all([
    findPendingInvitations(),
    findRecentAcceptedInvitations(),
    getPlanCatalogSummary(),
  ]);

  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const salonIds = accepted
    .map((invitation) => invitation.salon_id)
    .filter((id): id is string => id !== null);
  const salonNames = await findSalonNamesByIds(salonIds);

  const pendingInvitations = pending.map((invitation) => {
    const expiresAt = new Date(invitation.expires_at);

    return {
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      planName: invitation.plan_id ? planById.get(invitation.plan_id)?.name ?? null : null,
      createdAtLabel: formatDateTime(invitation.created_at),
      expiresAtLabel: formatDateTime(invitation.expires_at),
      expired: expiresAt.getTime() < now,
    };
  });

  return {
    pendingInvitations,
    acceptedInvitations: accepted.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      salonName: invitation.salon_id
        ? salonNames.get(invitation.salon_id) ?? "Salon eliminado"
        : "Salon eliminado",
      planName: invitation.plan_id ? planById.get(invitation.plan_id)?.name ?? null : null,
      acceptedAtLabel: invitation.accepted_at ? formatDateTime(invitation.accepted_at) : "—",
    })),
    assignablePlans: plans
      .filter((plan) => plan.status === "active")
      .map((plan) => ({
        id: plan.id,
        name: plan.name,
        priceLabel: `${plan.currency} ${plan.monthlyPrice.toFixed(2)}/mes`,
        trialDays: plan.trialDays,
      })),
    pendingCount: pendingInvitations.length,
    expiredCount: pendingInvitations.filter((invitation) => invitation.expired).length,
  };
}
