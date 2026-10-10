import "server-only";

import { findSalonIdentity } from "../data/salon-settings.repo";

export interface SalonIdentityView {
  name: string;
  timezone: string;
  payment_methods: string[];
}

export async function getSalonIdentity(salonId: string): Promise<SalonIdentityView | null> {
  return findSalonIdentity(salonId);
}
