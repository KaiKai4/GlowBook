import "server-only";

import { findSalonOverviews } from "../data/salon-overviews.repo";

export type PlatformSalonOverviewItem =
  Awaited<ReturnType<typeof findSalonOverviews>>[number];

export interface PlatformSalonOverviewsViewModel {
  salons: PlatformSalonOverviewItem[];
  metrics: {
    totalSalons: number;
    activeSalons: number;
    totalAppointments: number;
  };
}

export async function getPlatformSalonOverviews(): Promise<PlatformSalonOverviewsViewModel> {
  const salons = await findSalonOverviews();

  return {
    salons,
    metrics: {
      totalSalons: salons.length,
      activeSalons: salons.filter((salon) => salon.is_active).length,
      totalAppointments: salons.reduce(
        (total, salon) => total + salon.appointment_count,
        0
      ),
    },
  };
}
