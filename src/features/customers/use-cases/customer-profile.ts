import {
  createCustomer,
  updateCustomer,
} from "@/features/customers/data/customers.repo";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/features/customers/schemas";
import type { Result } from "@/lib/result";
import { rejectArchivedDuplicate } from "./customer-duplicates";

function mapCustomerConstraintError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("uq_customer_phone_per_salon")) {
    return "Ya existe un cliente con ese telefono.";
  }

  if (message.includes("uq_customer_email_per_salon")) {
    return "Ya existe un cliente con ese email.";
  }

  return fallback;
}

export async function createCustomerProfile(
  salonId: string,
  input: CreateCustomerInput
): Promise<Result<string>> {
  const duplicate = await rejectArchivedDuplicate(salonId, input);
  if (!duplicate.ok) return duplicate;

  try {
    const customer = await createCustomer(salonId, input);
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
    await updateCustomer(customerId, salonId, input);
    return { ok: true, value: undefined };
  } catch (error) {
    console.error("[customers:profile]", error);
    return {
      ok: false,
      error: mapCustomerConstraintError(error, "Error al actualizar el cliente."),
    };
  }
}
