import "server-only";

import { findCategoriesWithServices } from "../data/services.repo";

type SchedulingPricingMode = "fixed" | "variable";

interface SchedulingCategoryOption {
  id: string;
  name: string;
  pricing_mode?: SchedulingPricingMode;
}

interface SchedulingServiceOption {
  id: string;
  name: string;
  category_id: string;
  duration_minutes: number;
  price: number;
}

export interface ServiceSchedulingOptions {
  categories: SchedulingCategoryOption[];
  services: SchedulingServiceOption[];
}

/**
 * Servicios que se ofrecen para agendar: los activos, más los inactivos de
 * `keepServiceIds` (p. ej. los que ya tiene una cita en edición), marcados con
 * "(inactivo)". El resto de inactivos no se ofrece.
 */
export async function getServiceSchedulingOptions(
  salonId: string,
  keepServiceIds: readonly string[] = []
): Promise<ServiceSchedulingOptions> {
  const categories = await findCategoriesWithServices(salonId);
  const kept = new Set(keepServiceIds);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      pricing_mode: category.pricing_mode as SchedulingPricingMode | undefined,
    })),
    services: categories.flatMap((category) =>
      (category.services ?? [])
        .filter((service) => service.is_active || kept.has(service.id))
        .map((service) => ({
        id: service.id,
        name: service.is_active ? service.name : `${service.name} (inactivo)`,
        category_id: category.id,
        duration_minutes: service.duration_minutes,
        price: Number(service.price),
      }))
    ),
  };
}
