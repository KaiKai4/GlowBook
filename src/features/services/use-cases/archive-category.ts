import { captureError } from "@/infra/observability";
import "server-only";

import type { Result } from "@/infra/result";
import { archiveCategory } from "../data/services.repo";

export async function archiveServiceCategory(
  categoryId: string,
  salonId: string
): Promise<Result<void>> {
  try {
    await archiveCategory(categoryId, salonId);
    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "services", action: "archive_category" });
    return { ok: false, error: "No se pudo archivar la categoría." };
  }
}
