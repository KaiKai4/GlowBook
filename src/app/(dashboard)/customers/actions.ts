"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createCustomer, updateCustomer } from "@/features/customers/data/customers.repo";
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
  } catch {
    return { ok: false, error: "Error al actualizar el cliente." };
  }
}
