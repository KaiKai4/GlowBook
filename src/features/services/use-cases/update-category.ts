import "server-only";

import { captureError } from "@/infra/observability";
import type { Result } from "@/infra/result";
import { updateCategory } from "../data/services.repo";
import type { UpdateCategoryInput } from "../schemas";
import { isUniqueConstraintError } from "./errors";

export async function updateServiceCategory(
  categoryId: string,
  salonId: string,
  input: UpdateCategoryInput
): Promise<Result<void>> {
  try {
    await updateCategory(categoryId, salonId, input);
    return { ok: true, value: undefined };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "Ya existe una categoría con ese nombre." };
    }

    captureError(error, { module: "services", action: "update-category" });
    return { ok: false, error: "Error al actualizar la categoría." };
  }
}
