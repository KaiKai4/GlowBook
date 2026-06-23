import "server-only";

import type { Result } from "@/lib/result";
import { archiveCategory } from "../data/services.repo";

export async function archiveServiceCategory(
  categoryId: string,
  salonId: string
): Promise<Result<void>> {
  try {
    await archiveCategory(categoryId, salonId);
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "No se pudo archivar la categoria." };
  }
}
