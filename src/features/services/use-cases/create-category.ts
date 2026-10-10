import "server-only";

import type { Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
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

    captureError(error, { module: "services", action: "create-category" });
    return { ok: false, error: "Error al crear la categoria." };
  }
}
