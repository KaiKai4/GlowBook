import "server-only";

import type { Result } from "@/infra/result";
import { updateService } from "../data/services.repo";
import type { UpdateServiceInput } from "../schemas";
import { isCategoryOwnershipError, isUniqueConstraintError } from "./errors";

export async function updateCatalogService(
  serviceId: string,
  salonId: string,
  input: UpdateServiceInput
): Promise<Result<void>> {
  try {
    await updateService(serviceId, salonId, input);
    return { ok: true, value: undefined };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "Ya existe un servicio con ese nombre." };
    }
    if (isCategoryOwnershipError(error)) {
      return { ok: false, error: "La categoria no pertenece al salon o esta inactiva." };
    }

    return { ok: false, error: "Error al actualizar el servicio." };
  }
}
