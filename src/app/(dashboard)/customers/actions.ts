"use server";

import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { CreateCustomerSchema, UpdateCustomerSchema } from "@/features/customers/schemas";
import {
  checkPermanentCustomerByPhone,
  findArchivedCustomerByContact,
  type ArchivedCustomerMatch,
} from "@/features/customers/use-cases/customer-duplicates";
import {
  createCustomerProfile,
  updateCustomerProfile,
} from "@/features/customers/use-cases/customer-profile";
import {
  archiveCustomer,
  reactivateCustomer,
} from "@/features/customers/use-cases/customer-lifecycle";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing/use-cases/commercial-plans";
import {
  deleteTemporaryCustomer,
  findOrCreateTemporaryCustomer,
  promoteCustomer,
} from "@/features/customers/use-cases/customer-temporary";
import type { Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";
import { parseUuid } from "@/infra/validation/route-id";

async function canManageCustomers(
  profile: Awaited<ReturnType<typeof requireActiveProfile>>,
  deniedMessage = "No tienes permiso para gestionar clientes."
): Promise<Result<void>> {
  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return { ok: false, error: deniedMessage };
  }

  return assertActionRateLimit(profile.id, "customers", { max: 60, windowMs: 60_000 });
}

function revalidateCustomerFlows(): void {
  revalidatePath("/customers");
  revalidatePath("/appointments/new");
}

export async function createCustomerAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const profile = await requireActiveProfile();
  const permission = await canManageCustomers(profile);
  if (!permission.ok) return permission;
  const moduleAccess = await checkPlanModuleAccess({ salonId: profile.salon_id, moduleKey: "customers" });
  if (!moduleAccess.ok) return { ok: false, error: moduleAccess.error };
  const limit = await checkPlanLimit({ salonId: profile.salon_id, metricKey: "customers.active" });
  if (!limit.ok) return { ok: false, error: limit.error };

  const parsed = CreateCustomerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await createCustomerProfile(profile.salon_id, parsed.data);
  if (result.ok) revalidatePath("/customers");
  return result;
}

// Checks if a phone number already belongs to a permanent customer in this salon.
export async function checkCustomerPhoneAction(
  phone: string
): Promise<{ exists: boolean; archived?: boolean }> {
  const profile = await requireActiveProfile();
  const permission = await canManageCustomers(profile);
  if (!permission.ok) return { exists: false };

  return checkPermanentCustomerByPhone(profile.salon_id, phone);
}

export async function findArchivedCustomerByContactAction(
  phone?: string,
  email?: string
): Promise<ArchivedCustomerMatch | null> {
  const profile = await requireActiveProfile();
  const permission = await canManageCustomers(profile);
  if (!permission.ok) return null;

  return findArchivedCustomerByContact(profile.salon_id, phone, email);
}

export async function reactivateCustomerAction(customerId: string): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const permission = await canManageCustomers(profile);
  if (!permission.ok) return permission;
  if (!parseUuid(customerId)) return { ok: false, error: "Identificador inválido." };

  const result = await reactivateCustomer(customerId, profile.salon_id);
  if (result.ok) revalidateCustomerFlows();
  return result;
}

// Creates a temporary customer for appointment booking.
// The customer is invisible in all lists until promoted (on complete or cancel+save).
export async function findOrCreateCustomerAction(
  firstName: string,
  lastName: string,
  phone?: string
): Promise<Result<string>> {
  const profile = await requireActiveProfile();
  const permission = await canManageCustomers(profile);
  if (!permission.ok) return permission;

  return findOrCreateTemporaryCustomer({
    salonId: profile.salon_id,
    firstName,
    lastName,
    phone,
  });
}

// Promotes a temporary customer to permanent (visible in customer list, active).
export async function promoteCustomerAction(customerId: string): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const permission = await canManageCustomers(profile, "Sin permiso para gestionar clientes.");
  if (!permission.ok) return permission;
  if (!parseUuid(customerId)) return { ok: false, error: "Identificador inválido." };

  const result = await promoteCustomer(customerId, profile.salon_id);
  if (result.ok) revalidatePath("/customers");
  return result;
}

// Hard-deletes a temporary customer so the phone number is freed for future bookings.
// Only works if the customer is still marked is_temporary=true.
export async function deleteTemporaryCustomerAction(customerId: string): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const permission = await canManageCustomers(profile, "Sin permiso para gestionar clientes.");
  if (!permission.ok) return permission;
  if (!parseUuid(customerId)) return { ok: false, error: "Identificador inválido." };

  return deleteTemporaryCustomer(customerId, profile.salon_id);
}

export async function updateCustomerAction(
  customerId: string,
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const permission = await canManageCustomers(profile);
  if (!permission.ok) return permission;
  if (!parseUuid(customerId)) return { ok: false, error: "Identificador inválido." };

  const parsed = UpdateCustomerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await updateCustomerProfile(customerId, profile.salon_id, parsed.data);
  if (result.ok) revalidatePath("/customers");
  return result;
}

export async function deleteCustomerAction(
  customerId: string
): Promise<Result<{ outcome: "deleted" | "archived"; message: string }>> {
  const profile = await requireActiveProfile();
  const permission = await canManageCustomers(profile);
  if (!permission.ok) return permission;
  if (!parseUuid(customerId)) return { ok: false, error: "Identificador inválido." };

  const result = await archiveCustomer(customerId, profile.salon_id);
  if (result.ok) revalidateCustomerFlows();
  return result;
}
