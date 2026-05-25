"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createCustomer, updateCustomer, findCustomerByPhone, findCustomerByEmail, deleteCustomer } from "@/features/customers/data/customers.repo";
import { CreateCustomerSchema, UpdateCustomerSchema } from "@/features/customers/schemas";
import type { Result } from "@/lib/result";

export async function createCustomerAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar clientes." };
  }

  const parsed = CreateCustomerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const phone = parsed.data.phone?.trim();
    const email = parsed.data.email?.trim();
    const archivedByPhone = phone ? await findCustomerByPhone(profile.salon_id, phone) : null;
    const archivedByEmail = email ? await findCustomerByEmail(profile.salon_id, email) : null;
    const archivedMatch = [archivedByPhone, archivedByEmail].find(
      (customer) => customer && !customer.is_active && !customer.is_temporary
    );

    if (archivedMatch) {
      return {
        ok: false,
        error: "Ya existe un cliente archivado con esos datos. Reactivalo en la vista Archivados para conservar su historial.",
      };
    }

    const customer = await createCustomer(profile.salon_id, parsed.data);
    revalidatePath("/customers");
    return { ok: true, value: customer.id };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("uq_customer_phone_per_salon")) {
      return { ok: false, error: "Ya existe un cliente con ese teléfono." };
    }
    if (msg.includes("uq_customer_email_per_salon")) {
      return { ok: false, error: "Ya existe un cliente con ese email." };
    }
    return { ok: false, error: "Error al crear el cliente." };
  }
}

// Checks if a phone number already belongs to a permanent customer in this salon.
export async function checkCustomerPhoneAction(phone: string): Promise<{ exists: boolean; archived?: boolean }> {
  const profile = await requireProfile();
  if (!phone) return { exists: false };
  const existing = await findCustomerByPhone(profile.salon_id, phone);
  if (!existing || existing.is_temporary) return { exists: false };
  return { exists: true, archived: !existing.is_active };
}

export interface ArchivedCustomerMatch {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export async function findArchivedCustomerByContactAction(
  phone?: string,
  email?: string
): Promise<ArchivedCustomerMatch | null> {
  const profile = await requireProfile();
  const trimmedPhone = phone?.trim();
  const trimmedEmail = email?.trim();
  if (!trimmedPhone && !trimmedEmail) return null;

  const matches = await Promise.all([
    trimmedPhone ? findCustomerByPhone(profile.salon_id, trimmedPhone) : Promise.resolve(null),
    trimmedEmail ? findCustomerByEmail(profile.salon_id, trimmedEmail) : Promise.resolve(null),
  ]);
  const archived = matches.find((customer) => customer && !customer.is_active && !customer.is_temporary);
  if (!archived) return null;

  return {
    id: archived.id,
    name: `${archived.first_name} ${archived.last_name}`.trim(),
    phone: archived.phone,
    email: archived.email,
  };
}

export async function reactivateCustomerAction(customerId: string): Promise<Result<void>> {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar clientes." };
  }

  try {
    await updateCustomer(customerId, profile.salon_id, {
      is_active: true,
      is_temporary: false,
    });
    revalidatePath("/customers");
    revalidatePath("/appointments/new");
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[customers]", err);
    return { ok: false, error: "No se pudo reactivar el cliente." };
  }
}

// Creates a temporary customer for appointment booking.
// The customer is invisible in all lists until promoted (on complete or cancel+save).
export async function findOrCreateCustomerAction(
  firstName: string,
  lastName: string,
  phone?: string
): Promise<Result<string>> {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar clientes." };
  }

  try {
    const customer = await createCustomer(profile.salon_id, {
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      is_temporary: true,
      is_active: false,
    });
    return { ok: true, value: customer.id };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (msg.includes("uq_customer_phone_per_salon") && phone) {
      const existing = await findCustomerByPhone(profile.salon_id, phone);
      if (!existing) return { ok: false, error: "Ya existe un cliente con ese teléfono." };
      // Reuse existing temporary record (update name in case it changed)
      if (existing.is_temporary) {
        const updated = await updateCustomer(existing.id, profile.salon_id, {
          first_name: firstName,
          last_name: lastName,
        });
        return { ok: true, value: updated.id };
      }
      // Permanent customer with this phone — just use them
      if (!existing.is_active) {
        return {
          ok: false,
          error: "Este cliente está archivado. Reactívalo en Clientes > Archivados antes de agendar una nueva cita.",
        };
      }
      return { ok: true, value: existing.id };
    }
    return { ok: false, error: "Error al crear el cliente." };
  }
}

// Promotes a temporary customer to permanent (visible in customer list, active).
export async function promoteCustomerAction(customerId: string): Promise<Result<void>> {
  const profile = await requireProfile();
  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return { ok: false, error: "Sin permiso para gestionar clientes." };
  }
  try {
    await updateCustomer(customerId, profile.salon_id, { is_temporary: false, is_active: true });
    revalidatePath("/customers");
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[customers]", err);
    return { ok: false, error: "Error al guardar el cliente." };
  }
}

// Hard-deletes a temporary customer so the phone number is freed for future bookings.
// Only works if the customer is still marked is_temporary=true.
export async function deleteTemporaryCustomerAction(customerId: string): Promise<Result<void>> {
  const profile = await requireProfile();
  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return { ok: false, error: "Sin permiso para gestionar clientes." };
  }
  try {
    await deleteCustomer(customerId, profile.salon_id);
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[customers]", err);
    return { ok: false, error: "Error al descartar el cliente." };
  }
}

export async function updateCustomerAction(
  customerId: string,
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar clientes." };
  }

  const parsed = UpdateCustomerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await updateCustomer(customerId, profile.salon_id, parsed.data);
    revalidatePath("/customers");
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[customers]", err);
    return { ok: false, error: "Error al actualizar el cliente." };
  }
}

export async function deleteCustomerAction(
  customerId: string
): Promise<Result<{ outcome: "deleted" | "archived"; message: string }>> {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar clientes." };
  }

  try {
    await updateCustomer(customerId, profile.salon_id, {
      is_active: false,
    });
    revalidatePath("/customers");
    revalidatePath("/appointments/new");
    return {
      ok: true,
      value: {
        outcome: "archived",
        message: "Cliente archivado conservando su información para trazabilidad.",
      },
    };
  } catch (err) {
    console.error("[customers]", err);
    return { ok: false, error: "No se pudo archivar el cliente." };
  }
}
