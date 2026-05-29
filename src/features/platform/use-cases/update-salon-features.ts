import { setSalonDisabledFeatures } from "@/features/platform/data/salons.repo";
import {
  normalizeDisabledSalonFeatures,
  type SalonFeatureKey,
} from "@/features/salon/domain/salon-features";
import type { Result } from "@/lib/result";

export async function updateSalonFeatures({
  salonId,
  disabledFeatures,
}: {
  salonId: string;
  disabledFeatures: readonly string[];
}): Promise<Result<SalonFeatureKey[]>> {
  const normalized = normalizeDisabledSalonFeatures(disabledFeatures);

  try {
    await setSalonDisabledFeatures(salonId, normalized);
    return { ok: true, value: normalized };
  } catch (error) {
    console.error("[platform:salon-features]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return {
      ok: false,
      error: `No se pudieron actualizar las funciones. Detalle: ${message}`,
    };
  }
}
