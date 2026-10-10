import { deleteSalonCompletely } from "@/features/platform/data/delete-salon.repo";
import { captureError } from "@/infra/observability";
import { ok, type Result } from "@/infra/result";
import { publishAuditEvent } from "@/features/audit";
import { PublicError } from "@/infra/public-error";

const DELETE_FAILED_MESSAGE = "No se pudo eliminar el salón y sus datos.";

export interface DeleteSalonInput {
  salonId: string;
  confirmation: string;
  actorUserId?: string | null;
}

export async function deleteSalon({
  salonId,
  confirmation,
  actorUserId,
}: DeleteSalonInput): Promise<Result<void>> {
  if (confirmation !== salonId) {
    await publishAuditEvent("platform.salon_deleted", {
      actorUserId: actorUserId ?? null,
      action: "delete_salon",
      status: "failed",
      targetSalonId: salonId,
      errorMessage: "Confirmation mismatch.",
    });
    return {
      ok: false,
      error: "Para eliminar el salon debes escribir exactamente su ID.",
    };
  }

  try {
    await deleteSalonCompletely(salonId);
    const warnings = await publishAuditEvent("platform.salon_deleted", {
      actorUserId: actorUserId ?? null,
      action: "delete_salon",
      status: "succeeded",
      targetSalonId: salonId,
    });
    return ok(undefined, warnings);
  } catch (error) {
    captureError(error, {
      module: "platform",
      action: "delete_salon",
      metadata: { salonId },
    });
    const message = error instanceof Error ? error.message : "Error desconocido";
    await publishAuditEvent("platform.salon_deleted", {
      actorUserId: actorUserId ?? null,
      action: "delete_salon",
      status: "failed",
      targetSalonId: salonId,
      errorMessage: message,
    });
    // El detalle interno (BD, red) solo va al registro y a la auditoria; al usuario
    // solo llega un mensaje fijo o el PublicError lanzado a proposito (ADR 0018).
    return {
      ok: false,
      error: error instanceof PublicError ? error.message : DELETE_FAILED_MESSAGE,
    };
  }
}
