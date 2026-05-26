import { updateCustomer } from "@/features/customers/data/customers.repo";
import type { Result } from "@/lib/result";

export async function reactivateCustomer(
  customerId: string,
  salonId: string
): Promise<Result<void>> {
  try {
    await updateCustomer(customerId, salonId, {
      is_active: true,
      is_temporary: false,
    });

    return { ok: true, value: undefined };
  } catch (error) {
    console.error("[customers:lifecycle]", error);
    return { ok: false, error: "No se pudo reactivar el cliente." };
  }
}

export async function archiveCustomer(
  customerId: string,
  salonId: string
): Promise<Result<{ outcome: "archived"; message: string }>> {
  try {
    await updateCustomer(customerId, salonId, {
      is_active: false,
    });

    return {
      ok: true,
      value: {
        outcome: "archived",
        message: "Cliente archivado conservando su informacion para trazabilidad.",
      },
    };
  } catch (error) {
    console.error("[customers:lifecycle]", error);
    return { ok: false, error: "No se pudo archivar el cliente." };
  }
}
