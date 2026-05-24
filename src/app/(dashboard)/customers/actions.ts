"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createCustomer, updateCustomer, findCustomerByPhone, deleteCustomer } from "@/features/customers/data/customers.repo";
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
export async function checkCustomerPhoneAction(phone: string): Promise<{ exists: boolean }> {
  const profile = await requireProfile();
  if (!phone) return { exists: false };
  const existing = await findCustomerByPhone(profile.salon_id, phone);
  return { exists: !!existing && !existing.is_temporary };
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
