import "server-only";

import { err, ok, type Result } from "@/infra/result";
import { toResult } from "@/infra/to-result";
import { findActiveServiceCategory } from "../data/services.repo";

const SERVICE_CATEGORY_NOT_AVAILABLE_MESSAGE =
  "La categoría no pertenece al salón o está inactiva.";
const SERVICE_CATEGORY_CHECK_FAILED_MESSAGE = "No se pudo validar la categoría del servicio.";

/**
 * Regla de negocio: un servicio solo puede colgar de una categoria activa del
 * propio salon. Devuelve err con mensaje fijo si no se cumple; un fallo de
 * la consulta se registra y se devuelve como mensaje generico (ADR 0029).
 */
export async function validateServiceCategory(
  salonId: string,
  categoryId: string
): Promise<Result<void>> {
  const category = await toResult(() => findActiveServiceCategory(salonId, categoryId), {
    fallback: SERVICE_CATEGORY_CHECK_FAILED_MESSAGE,
    context: { module: "services", action: "validate-service-category" },
  });
  if (!category.ok) return category;
  if (!category.value) return err(SERVICE_CATEGORY_NOT_AVAILABLE_MESSAGE);
  return ok(undefined);
}
