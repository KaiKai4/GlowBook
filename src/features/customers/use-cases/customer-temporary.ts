import { captureError } from "@/infra/observability";
import { deleteCustomer, updateCustomer } from "@/features/customers/data/customers.repo";
import type { Result } from "@/infra/result";

export async function promoteCustomer(
  customerId: string,
  salonId: string
): Promise<Result<void>> {
  try {
    await updateCustomer(customerId, salonId, {
      is_temporary: false,
      is_active: true,
    });

    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "customers", action: "temporary" });
    return { ok: false, error: "Error al guardar el cliente." };
  }
}

export async function deleteTemporaryCustomer(
  customerId: string,
  salonId: string
): Promise<Result<void>> {
  try {
    await deleteCustomer(customerId, salonId);
    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "customers", action: "temporary" });
    return { ok: false, error: "Error al descartar el cliente." };
  }
}
