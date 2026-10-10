import {
  findCustomerByEmail,
  findCustomerByPhone,
} from "@/features/customers/data/customers.repo";
import {
  isPermanentCandidate,
  pickArchivedMatch,
  type ArchivedCustomerMatch,
} from "@/features/customers/domain/duplicates";
import type { CreateCustomerInput } from "@/features/customers/schemas";
import type { Result } from "@/infra/result";
import { normalizeOptionalPhoneInput } from "@/infra/format/phone";

export type { ArchivedCustomerMatch } from "@/features/customers/domain/duplicates";

export async function checkPermanentCustomerByPhone(
  salonId: string,
  phone: string
): Promise<{ exists: boolean; archived?: boolean }> {
  const trimmedPhone = normalizeOptionalPhoneInput(phone);
  if (!trimmedPhone) return { exists: false };

  const existing = await findCustomerByPhone(salonId, trimmedPhone);
  if (!existing || !isPermanentCandidate(existing)) return { exists: false };

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

  return pickArchivedMatch(matches);
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
    error: "Ya existe un cliente con esos datos. Restauralo para conservar su historial.",
  };
}
