import {
  createCustomer,
  deleteCustomer,
  findCustomerByPhone,
  updateCustomer,
} from "@/features/customers/data/customers.repo";
import {
  isValidOptionalPhone,
  normalizeOptionalPhoneInput,
  phoneValidationMessage,
} from "@/lib/utils/phone";
import type { Result } from "@/lib/result";

function databaseErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

function databaseErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : undefined;
}

function isPhoneUniquenessError(error: unknown): boolean {
  const message = databaseErrorMessage(error);
  return (
    databaseErrorCode(error) === "23505" ||
    message.includes("uq_customer_phone_per_salon")
  );
}

function normalizeOptionalPhone(phone: string | undefined): string | null {
  const trimmed = phone?.trim();
  if (!trimmed) return null;
  return normalizeOptionalPhoneInput(trimmed);
}

export async function findOrCreateTemporaryCustomer({
  salonId,
  firstName,
  lastName,
  phone,
}: {
  salonId: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<Result<string>> {
  if (!isValidOptionalPhone(phone)) {
    return { ok: false, error: phoneValidationMessage() };
  }

  const normalizedPhone = normalizeOptionalPhone(phone);
  const cleanFirstName = firstName.trim();
  const cleanLastName = lastName.trim();

  try {
    const customer = await createCustomer(salonId, {
      first_name: cleanFirstName,
      last_name: cleanLastName,
      phone: normalizedPhone,
      is_temporary: true,
      is_active: false,
    });

    return { ok: true, value: customer.id };
  } catch (error) {
    if (!isPhoneUniquenessError(error) || !normalizedPhone) {
      console.error("[customers:temporary:create]", error);
      return { ok: false, error: "Error al crear el cliente." };
    }

    const existing = await findCustomerByPhone(salonId, normalizedPhone);
    if (!existing) {
      return { ok: false, error: "Ya existe un cliente con ese telefono." };
    }

    if (existing.is_temporary) {
      try {
        const updated = await updateCustomer(existing.id, salonId, {
          first_name: cleanFirstName,
          last_name: cleanLastName,
        });
        return { ok: true, value: updated.id };
      } catch (updateError) {
        console.error("[customers:temporary:update-existing]", updateError);
        return { ok: false, error: "Error al actualizar el cliente temporal." };
      }
    }

    if (!existing.is_active) {
      return {
        ok: false,
        error: "Este cliente no esta disponible para nuevas citas. Restauralo desde Clientes para conservar su historial.",
      };
    }

    return { ok: true, value: existing.id };
  }
}

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
    console.error("[customers:temporary]", error);
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
    console.error("[customers:temporary]", error);
    return { ok: false, error: "Error al descartar el cliente." };
  }
}
