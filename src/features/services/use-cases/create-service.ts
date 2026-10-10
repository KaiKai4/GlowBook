import "server-only";

import { captureError } from "@/infra/observability";
import { PublicError } from "@/infra/public-error";
import type { Result } from "@/infra/result";
import { createService } from "../data/services.repo";
import type { CreateServiceInput } from "../schemas";
import { isUniqueConstraintError } from "./errors";
import { validateServiceCategory } from "./validate-service-category";

export async function createCatalogService(
  salonId: string,
  input: CreateServiceInput
): Promise<Result<string>> {
  try {
    await validateServiceCategory(salonId, input.category_id);
    const service = await createService(salonId, input);
    return { ok: true, value: service.id };
  } catch (error) {
    if (error instanceof PublicError) return { ok: false, error: error.message };
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "Ya existe un servicio con ese nombre." };
    }

    captureError(error, { module: "services", action: "create-service" });
    return { ok: false, error: "Error al crear el servicio." };
  }
}
