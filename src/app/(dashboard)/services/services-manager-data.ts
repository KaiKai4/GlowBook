import type { Category, ServiceStatusFilter } from "./services-types";

export const CATEGORIES_PER_PAGE = 3;

export interface ServicesTotals {
  categories: number;
  services: number;
  inactiveServices: number;
}

/** Totales del encabezado: categorías, servicios y servicios inactivos. */
export function getServicesTotals(categories: Category[]): ServicesTotals {
  const allServices = categories.flatMap((category) => category.services);

  return {
    categories: categories.length,
    services: allServices.length,
    inactiveServices: allServices.filter((service) => !service.is_active).length,
  };
}

/**
 * Filtra por categoría activa, texto y estado. Una categoría activa se mantiene
 * aunque no tenga servicios que coincidan, para que la vista no desaparezca.
 */
export function filterCategories(
  categories: Category[],
  activeCategoryId: string,
  query: string,
  statusFilter: ServiceStatusFilter,
): Category[] {
  const normalizedQuery = query.toLowerCase();

  return categories
    .filter((category) => activeCategoryId === "all" || category.id === activeCategoryId)
    .map((category) => ({
      ...category,
      services: category.services.filter((service) => {
        const matchesQuery = service.name.toLowerCase().includes(normalizedQuery);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && service.is_active) ||
          (statusFilter === "inactive" && !service.is_active);

        return matchesQuery && matchesStatus;
      }),
    }))
    .filter((category) => category.services.length > 0 || activeCategoryId === category.id);
}

export function getTotalCategoryPages(visibleCount: number): number {
  return Math.max(1, Math.ceil(visibleCount / CATEGORIES_PER_PAGE));
}

/** Página actual acotada al rango válido (si la lista se encoge, no queda en una página vacía). */
export function clampPage(page: number, totalPages: number): number {
  return Math.min(page, totalPages);
}

export function pageSlice<T>(items: T[], page: number): T[] {
  const start = (page - 1) * CATEGORIES_PER_PAGE;
  return items.slice(start, start + CATEGORIES_PER_PAGE);
}
