import { captureError } from "@/infra/observability";
import {
  findCustomerTemporaryFlag,
  updateCustomer,
} from "@/features/customers/data/customers.repo";
import { discardTemporaryCustomerRpc } from "@/features/customers/data/rpc/discard-temporary-customer";
import type { Result } from "@/infra/result";
import { assertCustomerQuotaAvailable, type AssertCustomerQuota } from "./customer-quota";

/** Dependencias de la promoción y descarte de temporales. Producción usa las funciones reales; los tests inyectan fakes. */
export interface CustomerTemporaryDeps {
  assertQuota: AssertCustomerQuota;
  updateCustomer: (
    customerId: string,
    salonId: string,
    input: Parameters<typeof updateCustomer>[2]
  ) => Promise<unknown>;
  discardTemporaryCustomerRpc: (customerId: string) => Promise<void>;
}

const defaultCustomerTemporaryDeps: CustomerTemporaryDeps = {
  assertQuota: assertCustomerQuotaAvailable,
  updateCustomer,
  discardTemporaryCustomerRpc,
};

/** Mensajes públicos fijos por SQLSTATE de discard_temporary_customer (ADR 0018). */
const DISCARD_MESSAGES: Readonly<Record<string, string>> = {
  "42501": "No tienes permiso para descartar clientes.",
  P0002: "El cliente no existe en este salón.",
  "22023": "El cliente no se puede descartar: tiene citas activas o completadas.",
};
const DISCARD_FALLBACK = "Error al descartar el cliente.";

function sqlStateOf(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return null;
}

export async function promoteCustomer(
  customerId: string,
  salonId: string,
  deps: CustomerTemporaryDeps = defaultCustomerTemporaryDeps
): Promise<Result<void>> {
  try {
    // El cupo se comprueba antes de escribir: promover un temporal activa un cliente.
    const limit = await deps.assertQuota(salonId);
    if (!limit.ok) return limit;

    await deps.updateCustomer(customerId, salonId, {
      is_temporary: false,
      is_active: true,
    });

    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "customers", action: "temporary" });
    return { ok: false, error: "Error al guardar el cliente." };
  }
}

/**
 * Descarta un cliente temporal con sus citas canceladas o no presentadas (RPC transaccional).
 * El salón lo fija el claim del JWT dentro de la RPC, no se pasa desde aquí.
 */
export async function deleteTemporaryCustomer(
  customerId: string,
  deps: CustomerTemporaryDeps = defaultCustomerTemporaryDeps
): Promise<Result<void>> {
  try {
    await deps.discardTemporaryCustomerRpc(customerId);
    return { ok: true, value: undefined };
  } catch (error) {
    const sqlState = sqlStateOf(error);
    const publicMessage = sqlState === null ? undefined : DISCARD_MESSAGES[sqlState];
    if (publicMessage === undefined) {
      captureError(error, { module: "customers", action: "temporary" });
      return { ok: false, error: DISCARD_FALLBACK };
    }
    return { ok: false, error: publicMessage };
  }
}

/** Un cliente es temporal si existe en el salón con la marca. Un cliente inexistente no lo es. */
export async function isTemporaryCustomer(customerId: string, salonId: string): Promise<boolean> {
  return (await findCustomerTemporaryFlag(customerId, salonId)) === true;
}
