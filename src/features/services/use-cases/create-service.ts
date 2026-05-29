import "server-only";

import type { Result } from "@/lib/result";
import { createService } from "../data/services.repo";
import type { CreateServiceInput } from "../schemas";
import { isCategoryOwnershipError, isUniqueConstraintError } from "./errors";

export async function createCatalogService(
  salonId: string,
  input: CreateServiceInput
): Promise<Result<string>> {
  try {
    const service = await createService(salonId, input);
    return { ok: true, value: service.id };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "Ya existe un servicio con ese nombre." };
    }
    if (isCategoryOwnershipError(error)) {
      return { ok: false, error: "La categoria no pertenece al salon o esta inactiva." };
    }

    return { ok: false, error: "Error al crear el servicio." };
  }
}
