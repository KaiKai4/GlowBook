import "server-only";

import { findPendingInvitations } from "@/features/platform/data/invitations.repo";

export interface PlatformInvitationViewModel {
  id: string;
  email: string;
  token: string;
  createdAtLabel: string;
  expiresAtLabel: string;
  expired: boolean;
}

export interface PlatformInvitationsViewModel {
  pendingInvitations: PlatformInvitationViewModel[];
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
  const pendingInvitations = (await findPendingInvitations()).map((invitation) => {
    const expiresAt = new Date(invitation.expires_at);

    return {
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      createdAtLabel: formatDateTime(invitation.created_at),
      expiresAtLabel: formatDateTime(invitation.expires_at),
      expired: expiresAt.getTime() < now,
    };
  });

  return {
    pendingInvitations,
    pendingCount: pendingInvitations.length,
    expiredCount: pendingInvitations.filter((invitation) => invitation.expired).length,
  };
}
