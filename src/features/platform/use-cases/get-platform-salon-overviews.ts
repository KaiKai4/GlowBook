import "server-only";

import { findSalonOverviews } from "../data/salon-overviews.repo";
import { isDormantSalon } from "../domain/salon-health";

type PlatformSalonOverviewItem =
  Awaited<ReturnType<typeof findSalonOverviews>>[number];

export interface PlatformSalonOverviewsViewModel {
  salons: PlatformSalonOverviewItem[];
  metrics: {
    totalSalons: number;
    activeSalons: number;
    totalAppointments: number;
    /** Salones activos sin citas en el último mes: candidatos a churn. */
    dormantSalons: number;
  };
  dormantSalons: Array<{ id: string; name: string }>;
}

export async function getPlatformSalonOverviews(): Promise<PlatformSalonOverviewsViewModel> {
  const salons = await findSalonOverviews();
  const now = new Date();
  const dormant = salons.filter((salon) =>
    isDormantSalon({
      isActive: salon.is_active,
      createdAt: salon.created_at,
      lastAppointmentAt: salon.last_appointment_at,
      now,
    })
  );

  return {
    salons,
    metrics: {
      totalSalons: salons.length,
      activeSalons: salons.filter((salon) => salon.is_active).length,
      totalAppointments: salons.reduce(
        (total, salon) => total + salon.appointment_count,
        0
      ),
      dormantSalons: dormant.length,
    },
    dormantSalons: dormant.map((salon) => ({ id: salon.id, name: salon.name })),
  };
}
