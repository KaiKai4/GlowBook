import { findActiveAssignmentReferences } from "@/features/employees/data/employees-read.repo";
import { assertCollaboratorAssignments } from "@/features/employees/domain/collaborator-assignment";

/**
 * Valida las asignaciones de servicios y categorias de un colaborador contra el
 * salon. Lanza error si alguna no existe, esta inactiva o un servicio no tiene su
 * categoria asignada (los mensajes se traducen en la capa de errores publicos).
 */
export async function validateEmployeeAssignments(
  salonId: string,
  serviceIds: string[],
  categoryIds: string[]
): Promise<void> {
  const requestedServiceIds = [...new Set(serviceIds)];
  const requestedCategoryIds = [...new Set(categoryIds)];
  if (requestedServiceIds.length === 0 && requestedCategoryIds.length === 0) return;

  const references = await findActiveAssignmentReferences(salonId, requestedServiceIds, requestedCategoryIds);
  assertCollaboratorAssignments({
    requestedServiceIds,
    requestedCategoryIds,
    activeCategoryIds: references.activeCategoryIds,
    services: references.services,
  });
}
