import {
  findCustomerByEmail,
  findCustomerByPhone,
} from "@/features/customers/data/customers.repo";
import type { CreateCustomerInput } from "@/features/customers/schemas";
import type { Result } from "@/lib/result";
import { normalizeOptionalPhoneInput } from "@/lib/utils/phone";

export interface ArchivedCustomerMatch {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export async function checkPermanentCustomerByPhone(
  salonId: string,
  phone: string
): Promise<{ exists: boolean; archived?: boolean }> {
  const trimmedPhone = normalizeOptionalPhoneInput(phone);
  if (!trimmedPhone) return { exists: false };

  const existing = await findCustomerByPhone(salonId, trimmedPhone);
  if (!existing || existing.is_temporary) return { exists: false };

  return { exists: true, archived: !existing.is_active };
}

export async function findArchivedCustomerByContact(
  salonId: string,
  phone?: string,
  email?: string
): Promise<ArchivedCustomerMatch | null> {
  const trimmedPhone = phone ? normalizeOptionalPhoneInput(phone) : undefined;
  const trimmedEmail = email?.trim();
  if (!trimmedPhone && !trimmedEmail) return null;

  const matches = await Promise.all([
    trimmedPhone ? findCustomerByPhone(salonId, trimmedPhone) : Promise.resolve(null),
    trimmedEmail ? findCustomerByEmail(salonId, trimmedEmail) : Promise.resolve(null),
  ]);

  const archived = matches.find((customer) =>
    customer && !customer.is_active && !customer.is_temporary
  );
  if (!archived) return null;

  return {
    id: archived.id,
    name: `${archived.first_name} ${archived.last_name}`.trim(),
    phone: archived.phone,
    email: archived.email,
  };
}

export async function rejectArchivedDuplicate(
  salonId: string,
  input: Pick<CreateCustomerInput, "phone" | "email">
): Promise<Result<void>> {
  const match = await findArchivedCustomerByContact(
    salonId,
    input.phone ?? undefined,
    input.email ?? undefined
  );

  if (!match) return { ok: true, value: undefined };

  return {
    ok: false,
    error: "Ya existe un cliente archivado con esos datos. Reactivalo en la vista Archivados para conservar su historial.",
  };
}
