import {
  createCustomer,
  deleteCustomer,
  findCustomerByPhone,
  updateCustomer,
} from "@/features/customers/data/customers.repo";
import type { Result } from "@/lib/result";

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
  try {
    const customer = await createCustomer(salonId, {
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      is_temporary: true,
      is_active: false,
    });

    return { ok: true, value: customer.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!message.includes("uq_customer_phone_per_salon") || !phone) {
      return { ok: false, error: "Error al crear el cliente." };
    }

    const existing = await findCustomerByPhone(salonId, phone);
    if (!existing) {
      return { ok: false, error: "Ya existe un cliente con ese telefono." };
    }

    if (existing.is_temporary) {
      const updated = await updateCustomer(existing.id, salonId, {
        first_name: firstName,
        last_name: lastName,
      });
      return { ok: true, value: updated.id };
    }

    if (!existing.is_active) {
      return {
        ok: false,
        error: "Este cliente esta archivado. Reactivalo en Clientes > Archivados antes de agendar una nueva cita.",
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
