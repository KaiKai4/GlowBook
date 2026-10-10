import "server-only";

import { findCategoriesWithServices } from "../data/services.repo";

export interface CategoryServiceOption {
  id: string;
  name: string;
  services: { id: string; name: string }[];
}

export async function getCategoryServiceOptions(
  salonId: string
): Promise<CategoryServiceOption[]> {
  const categories = await findCategoriesWithServices(salonId);

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    services: (category.services ?? [])
      .filter((service) => service.is_active)
      .map((service) => ({
      id: service.id,
      name: service.name,
    })),
  }));
}
