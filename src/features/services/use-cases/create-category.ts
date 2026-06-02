import "server-only";

import type { Result } from "@/lib/result";
import { createCategory } from "../data/services.repo";
import type { CreateCategoryInput } from "../schemas";
import { isUniqueConstraintError } from "./errors";

export async function createServiceCategory(
  salonId: string,
  input: CreateCategoryInput
): Promise<Result<string>> {
  try {
    const category = await createCategory(salonId, {
      ...input,
      pricing_mode: input.pricing_mode ?? "fixed",
    });
    return { ok: true, value: category.id };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "Ya existe una categoria con ese nombre." };
    }

    return { ok: false, error: "Error al crear la categoria." };
  }
}
