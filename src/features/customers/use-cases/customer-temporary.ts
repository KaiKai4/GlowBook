import { captureError } from "@/infra/observability";
import {
  deleteCustomer,
  findCustomerTemporaryFlag,
  updateCustomer,
} from "@/features/customers/data/customers.repo";
import type { Result } from "@/infra/result";
import { assertCustomerQuotaAvailable } from "./customer-quota";

export async function promoteCustomer(
  customerId: string,
  salonId: string
): Promise<Result<void>> {
  try {
    // El cupo se comprueba antes de escribir: promover un temporal activa un cliente.
    const limit = await assertCustomerQuotaAvailable(salonId);
    if (!limit.ok) return limit;

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

/** Un cliente es temporal si existe en el salón con la marca. Un cliente inexistente no lo es. */
export async function isTemporaryCustomer(customerId: string, salonId: string): Promise<boolean> {
  return (await findCustomerTemporaryFlag(customerId, salonId)) === true;
}
