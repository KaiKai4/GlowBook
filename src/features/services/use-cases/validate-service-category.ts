import "server-only";

import { PublicError } from "@/infra/public-error";
import { findActiveServiceCategory } from "../data/services.repo";

const SERVICE_CATEGORY_NOT_AVAILABLE_MESSAGE =
  "La categoría no pertenece al salón o está inactiva.";

/**
 * Regla de negocio: un servicio solo puede colgar de una categoria activa del
 * propio salon. Lanza PublicError con mensaje fijo si no se cumple.
 */
export async function validateServiceCategory(salonId: string, categoryId: string): Promise<void> {
  const category = await findActiveServiceCategory(salonId, categoryId);
  if (!category) throw new PublicError(SERVICE_CATEGORY_NOT_AVAILABLE_MESSAGE);
}
