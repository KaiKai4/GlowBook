import { captureError } from "@/infra/observability";
import "server-only";

import type { Result } from "@/infra/result";
import { updateSalonName } from "../data/salon.repo";
import type { SalonInfoInput } from "../schemas";

export async function updateSalonInfo(
  salonId: string,
  input: SalonInfoInput
): Promise<Result<void>> {
  try {
    await updateSalonName(salonId, input.name);
    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "salon", action: "update_info" });
    return { ok: false, error: "Error al guardar el nombre del salon." };
  }
}
