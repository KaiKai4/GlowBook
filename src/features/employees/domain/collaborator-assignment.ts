import { PublicError } from "@/infra/public-error";
export interface ServiceCategoryRef {
  id: string;
  category_id: string;
}

function findServicesMissingAssignedCategory(
  services: ServiceCategoryRef[],
  assignedCategoryIds: string[]
): ServiceCategoryRef[] {
  const categorySet = new Set(assignedCategoryIds);
  return services.filter((service) => !categorySet.has(service.category_id));
}

function assertServicesHaveAssignedCategories(
  services: ServiceCategoryRef[],
  assignedCategoryIds: string[]
): void {
  const missing = findServicesMissingAssignedCategory(services, assignedCategoryIds);
  if (missing.length > 0) {
    throw new PublicError("Para asignar un servicio al colaborador, tambien debes asignar su categoria.");
  }
}

/**
 * Reglas de una asignacion de colaborador frente a lo que existe en el salon:
 * todas las categorias y servicios pedidos deben estar activos y en el salon, y
 * cada servicio exige su categoria asignada.
 */
export function assertCollaboratorAssignments(input: {
  requestedServiceIds: string[];
  requestedCategoryIds: string[];
  activeCategoryIds: string[];
  services: ServiceCategoryRef[];
}): void {
  if (input.activeCategoryIds.length !== input.requestedCategoryIds.length) {
    throw new Error("Una o mas categorías no pertenecen al salon o estan inactivas.");
  }
  if (input.services.length !== input.requestedServiceIds.length) {
    throw new Error("Uno o mas servicios no pertenecen al salon o estan inactivos.");
  }
  assertServicesHaveAssignedCategories(input.services, input.requestedCategoryIds);
}
