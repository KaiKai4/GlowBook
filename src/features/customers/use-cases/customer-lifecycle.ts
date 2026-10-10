import { updateCustomer } from "@/features/customers/data/customers.repo";
import type { Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import { assertCustomerQuotaAvailable, type AssertCustomerQuota } from "./customer-quota";

/** Dependencias del ciclo de vida (reactivar y archivar). Producción usa las funciones reales; los tests inyectan fakes. */
export interface CustomerLifecycleDeps {
  assertQuota: AssertCustomerQuota;
  updateCustomer: (
    customerId: string,
    salonId: string,
    input: Parameters<typeof updateCustomer>[2]
  ) => Promise<unknown>;
}

const defaultCustomerLifecycleDeps: CustomerLifecycleDeps = {
  assertQuota: assertCustomerQuotaAvailable,
  updateCustomer,
};

export async function reactivateCustomer(
  customerId: string,
  salonId: string,
  deps: CustomerLifecycleDeps = defaultCustomerLifecycleDeps
): Promise<Result<void>> {
  try {
    // El cupo se comprueba antes de escribir: reactivar un archivado activa un cliente.
    const limit = await deps.assertQuota(salonId);
    if (!limit.ok) return limit;

    await deps.updateCustomer(customerId, salonId, {
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
  salonId: string,
  deps: CustomerLifecycleDeps = defaultCustomerLifecycleDeps
): Promise<Result<{ outcome: "archived"; message: string }>> {
  try {
    await deps.updateCustomer(customerId, salonId, {
      is_active: false,
    });

    return {
      ok: true,
      value: {
        outcome: "archived",
        message: "Cliente archivado conservando su información para trazabilidad.",
      },
    };
  } catch (error) {
    captureError(error, { module: "customers", action: "lifecycle" });
    return { ok: false, error: "No se pudo archivar el cliente." };
  }
}
