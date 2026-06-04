import "server-only";

import { findSalonIdentity } from "../data/salon.repo";

export interface SalonIdentityView {
  name: string;
  timezone: string;
}

export async function getSalonIdentity(salonId: string): Promise<SalonIdentityView | null> {
  return findSalonIdentity(salonId);
}
