import "server-only";

import { captureError } from "@/infra/observability";
import { PublicError } from "@/infra/public-error";
import type { Result } from "@/infra/result";
import { updateService } from "../data/services.repo";
import type { UpdateServiceInput } from "../schemas";
import { isUniqueConstraintError } from "./errors";
import { validateServiceCategory } from "./validate-service-category";

export async function updateCatalogService(
  serviceId: string,
  salonId: string,
  input: UpdateServiceInput
): Promise<Result<void>> {
  try {
    if (input.category_id) await validateServiceCategory(salonId, input.category_id);
    await updateService(serviceId, salonId, input);
    return { ok: true, value: undefined };
  } catch (error) {
    if (error instanceof PublicError) return { ok: false, error: error.message };
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "Ya existe un servicio con ese nombre." };
    }

    captureError(error, { module: "services", action: "update-service" });
    return { ok: false, error: "Error al actualizar el servicio." };
  }
}
