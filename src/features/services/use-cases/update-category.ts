import "server-only";

import type { Result } from "@/lib/result";
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
      return { ok: false, error: "Ya existe una categoria con ese nombre." };
    }

    return { ok: false, error: "Error al actualizar la categoria." };
  }
}
