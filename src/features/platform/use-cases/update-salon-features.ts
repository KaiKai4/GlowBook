import { setSalonDisabledFeatures } from "@/features/platform/data/salons.repo";
import {
  normalizeDisabledSalonFeatures,
  type SalonFeatureKey,
} from "@/features/salon/domain/salon-features";
import { captureError } from "@/lib/observability";
import type { Result } from "@/lib/result";
import { recordPlatformAction } from "./platform-audit";

export interface UpdateSalonFeaturesInput {
  salonId: string;
  disabledFeatures: readonly string[];
  actorUserId?: string | null;
}

export async function updateSalonFeatures({
  salonId,
  disabledFeatures,
  actorUserId,
}: UpdateSalonFeaturesInput): Promise<Result<SalonFeatureKey[]>> {
  const normalized = normalizeDisabledSalonFeatures(disabledFeatures);

  try {
    await setSalonDisabledFeatures(salonId, normalized);
    await recordPlatformAction({
      actorUserId: actorUserId ?? null,
      action: "update_salon_features",
      status: "succeeded",
      targetSalonId: salonId,
      metadata: { disabledFeatures: normalized },
    });
    return { ok: true, value: normalized };
  } catch (error) {
    captureError(error, {
      module: "platform",
      action: "update_salon_features",
      metadata: { salonId, disabledFeatures: normalized },
    });
    const message = error instanceof Error ? error.message : "Error desconocido";
    await recordPlatformAction({
      actorUserId: actorUserId ?? null,
      action: "update_salon_features",
      status: "failed",
      targetSalonId: salonId,
      metadata: { disabledFeatures: normalized },
      errorMessage: message,
    });
    return {
      ok: false,
      error: `No se pudieron actualizar las funciones. Detalle: ${message}`,
    };
  }
}
