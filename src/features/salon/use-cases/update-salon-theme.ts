import "server-only";

import type { Result } from "@/infra/result";
import { updateSalonTheme as updateSalonThemeRow } from "../data/salon.repo";
import { SALON_THEMES, type SalonTheme } from "../schemas";

export async function updateSalonTheme(
  salonId: string,
  theme: string
): Promise<Result<void>> {
  if (!SALON_THEMES.includes(theme as SalonTheme)) {
    return { ok: false, error: "Tema inválido." };
  }

  try {
    await updateSalonThemeRow(salonId, theme);
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "Error al guardar la gama de colores." };
  }
}
