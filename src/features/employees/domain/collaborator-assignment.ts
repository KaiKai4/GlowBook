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
    throw new PublicError("Para asignar un servicio al colaborador, también debes asignar su categoría.");
  }
}

/**
 * Reglas de una asignacion de colaborador frente a lo que existe en el salón:
 * todas las categorias y servicios pedidos deben estar activos y en el salón, y
 * cada servicio exige su categoria asignada.
 */
export function assertCollaboratorAssignments(input: {
  requestedServiceIds: string[];
  requestedCategoryIds: string[];
  activeCategoryIds: string[];
  services: ServiceCategoryRef[];
}): void {
  if (input.activeCategoryIds.length !== input.requestedCategoryIds.length) {
    throw new Error("Una o más categorías no pertenecen al salón o están inactivas.");
  }
  if (input.services.length !== input.requestedServiceIds.length) {
    throw new Error("Uno o más servicios no pertenecen al salón o están inactivos.");
  }
  assertServicesHaveAssignedCategories(input.services, input.requestedCategoryIds);
}
