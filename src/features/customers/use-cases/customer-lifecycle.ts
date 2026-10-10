import { updateCustomer } from "@/features/customers/data/customers.repo";
import type { Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import { assertCustomerQuotaAvailable } from "./customer-quota";

export async function reactivateCustomer(
  customerId: string,
  salonId: string
): Promise<Result<void>> {
  try {
    // El cupo se comprueba antes de escribir: reactivar un archivado activa un cliente.
    const limit = await assertCustomerQuotaAvailable(salonId);
    if (!limit.ok) return limit;

    await updateCustomer(customerId, salonId, {
      is_active: true,
      is_temporary: false,
    });

    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "customers", action: "lifecycle" });
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
    captureError(error, { module: "customers", action: "lifecycle" });
    return { ok: false, error: "No se pudo archivar el cliente." };
  }
}
