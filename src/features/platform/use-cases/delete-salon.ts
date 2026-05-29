import { deleteSalonCompletely } from "@/features/platform/data/delete-salon.repo";
import type { Result } from "@/lib/result";

export async function deleteSalon({
  salonId,
  confirmation,
}: {
  salonId: string;
  confirmation: string;
}): Promise<Result<void>> {
  if (confirmation !== salonId) {
    return {
      ok: false,
      error: "Para eliminar el salon debes escribir exactamente su ID.",
    };
  }

  try {
    await deleteSalonCompletely(salonId);
    return { ok: true, value: undefined };
  } catch (error) {
    console.error("[platform:delete-salon]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return {
      ok: false,
      error: `No se pudo eliminar el salon y sus datos. Detalle: ${message}`,
    };
  }
}
