import { PublicError } from "@/lib/public-error";
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

export function assertServicesHaveAssignedCategories(
  services: ServiceCategoryRef[],
  assignedCategoryIds: string[]
): void {
  const missing = findServicesMissingAssignedCategory(services, assignedCategoryIds);
  if (missing.length > 0) {
    throw new PublicError("Para asignar un servicio al colaborador, tambien debes asignar su categoria.");
  }
}
