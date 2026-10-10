import { captureError } from "@/infra/observability";
import { checkPlanModuleAccess } from "@/features/billing";
import {
  createCustomer,
  updateCustomer,
} from "@/features/customers/data/customers.repo";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/features/customers/schemas";
import { err, type Result } from "@/infra/result";
import { normalizeOptionalPhoneInput } from "@/infra/format/phone";
import { rejectArchivedDuplicate } from "./customer-duplicates";
import { assertCustomerQuotaAvailable } from "./customer-quota";

function mapCustomerConstraintError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("uq_customer_phone_per_salon")) {
    return "Ya existe un cliente con ese teléfono.";
  }

  if (message.includes("uq_customer_email_per_salon")) {
    return "Ya existe un cliente con ese email.";
  }

  return fallback;
}

/**
 * Da de alta el cliente solo si el plan del salon incluye el modulo de clientes y
 * queda cupo de clientes activos.
 */
export async function createCustomerProfile(
  salonId: string,
  input: CreateCustomerInput
): Promise<Result<string>> {
  const moduleAccess = await checkPlanModuleAccess({ salonId, moduleKey: "customers" });
  if (!moduleAccess.ok) return err(moduleAccess.error);

  const limit = await assertCustomerQuotaAvailable(salonId);
  if (!limit.ok) return err(limit.error);

  const normalizedInput = normalizeCustomerPhone(input);
  const duplicate = await rejectArchivedDuplicate(salonId, normalizedInput);
  if (!duplicate.ok) return duplicate;

  try {
    const customer = await createCustomer(salonId, normalizedInput);
    return { ok: true, value: customer.id };
  } catch (error) {
    return {
      ok: false,
      error: mapCustomerConstraintError(error, "Error al crear el cliente."),
    };
  }
}

export async function updateCustomerProfile(
  customerId: string,
  salonId: string,
  input: UpdateCustomerInput
): Promise<Result<void>> {
  try {
    await updateCustomer(customerId, salonId, normalizeCustomerPhone(input));
    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "customers", action: "profile" });
    return {
      ok: false,
      error: mapCustomerConstraintError(error, "Error al actualizar el cliente."),
    };
  }
}

function normalizeCustomerPhone<T extends { phone?: string | null }>(input: T): T {
  if (!input.phone) return input;
  return {
    ...input,
    phone: normalizeOptionalPhoneInput(input.phone),
  };
}
