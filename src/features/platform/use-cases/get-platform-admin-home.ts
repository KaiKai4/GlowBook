import "server-only";

import { findPendingInvitations } from "../data/invitations.repo";
import { findAllSalons } from "../data/salons.repo";

type PlatformAdminSalon = Awaited<ReturnType<typeof findAllSalons>>[number];
type PlatformAdminPendingInvitation =
  Awaited<ReturnType<typeof findPendingInvitations>>[number];

export interface PlatformAdminHomeViewModel {
  salons: PlatformAdminSalon[];
  pendingInvitations: PlatformAdminPendingInvitation[];
  metrics: {
    totalSalons: number;
    activeSalons: number;
    pendingInvitations: number;
  };
}

export async function getPlatformAdminHome(): Promise<PlatformAdminHomeViewModel> {
  const [salons, pendingInvitations] = await Promise.all([
    findAllSalons(),
    findPendingInvitations(),
  ]);

  return {
    salons,
    pendingInvitations,
    metrics: {
      totalSalons: salons.length,
      activeSalons: salons.filter((salon) => salon.is_active).length,
      pendingInvitations: pendingInvitations.length,
    },
  };
}
