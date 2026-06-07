import "server-only";

import { cache } from "react";
import { findSalonIdentity } from "../data/salon.repo";

export interface SalonIdentityView {
  name: string;
  timezone: string;
  payment_methods: string[];
}

export const getSalonIdentity = cache(async (salonId: string): Promise<SalonIdentityView | null> => {
  return findSalonIdentity(salonId);
});
