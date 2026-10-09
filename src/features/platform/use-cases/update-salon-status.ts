import { setSalonActiveStatus } from "@/features/platform/data/salons.repo";
import { captureError } from "@/lib/observability";
import { ok, type Result } from "@/lib/result";
import { publishAuditEvent } from "@/features/audit";

export interface UpdateSalonStatusInput {
  salonId: string;
  isActive: boolean;
  actorUserId?: string | null;
}

export async function updateSalonStatus({
  salonId,
  isActive,
  actorUserId,
}: UpdateSalonStatusInput): Promise<Result<boolean>> {
  const trimmedSalonId = salonId.trim();
  if (!trimmedSalonId) {
    return { ok: false, error: "Salon inválido." };
  }

  try {
    await setSalonActiveStatus(trimmedSalonId, isActive);
    const warnings = await publishAuditEvent("platform.salon_status_changed", {
      actorUserId: actorUserId ?? null,
      action: "set_salon_status",
      status: "succeeded",
      targetSalonId: trimmedSalonId,
      metadata: { isActive },
    });
    return ok(isActive, warnings);
  } catch (error) {
    captureError(error, {
      module: "platform",
      action: "set_salon_status",
      metadata: { salonId: trimmedSalonId, isActive },
    });
    const message = error instanceof Error ? error.message : "Error desconocido";
    await publishAuditEvent("platform.salon_status_changed", {
      actorUserId: actorUserId ?? null,
      action: "set_salon_status",
      status: "failed",
      targetSalonId: trimmedSalonId,
      metadata: { isActive },
      errorMessage: message,
    });
    return {
      ok: false,
      error: `No se pudo actualizar el estado del salon. Detalle: ${message}`,
    };
  }
}
