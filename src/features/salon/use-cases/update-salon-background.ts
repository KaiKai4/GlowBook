import "server-only";

import type { Result } from "@/infra/result";
import { updateSalonBackground as updateSalonBackgroundRow } from "../data/salon.repo";
import { SALON_BG_STYLES, type SalonBgStyle } from "../schemas";

export async function updateSalonBackground(
  salonId: string,
  bgStyle: string
): Promise<Result<void>> {
  if (!SALON_BG_STYLES.includes(bgStyle as SalonBgStyle)) {
    return { ok: false, error: "Estilo de fondo inválido." };
  }

  try {
    await updateSalonBackgroundRow(salonId, bgStyle);
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "Error al guardar el fondo." };
  }
}
