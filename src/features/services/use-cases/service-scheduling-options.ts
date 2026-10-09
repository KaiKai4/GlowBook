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

export async function getServiceSchedulingOptions(
  salonId: string
): Promise<ServiceSchedulingOptions> {
  const categories = await findCategoriesWithServices(salonId);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      pricing_mode: category.pricing_mode as SchedulingPricingMode | undefined,
    })),
    services: categories.flatMap((category) =>
      (category.services ?? []).filter((service) => service.is_active).map((service) => ({
        id: service.id,
        name: service.name,
        category_id: category.id,
        duration_minutes: service.duration_minutes,
        price: Number(service.price),
      }))
    ),
  };
}
