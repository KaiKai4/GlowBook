import {
  findCustomerByEmail,
  findCustomerByPhone,
} from "@/features/customers/data/customers.repo";
import {
  isPermanentCandidate,
  pickArchivedMatch,
  type ArchivedCustomerMatch,
  type DuplicateCandidate,
} from "@/features/customers/domain/duplicates";
import type { CreateCustomerInput } from "@/features/customers/schemas";
import type { Result } from "@/infra/result";
import { normalizeOptionalPhoneInput } from "@/infra/format/phone";

export type { ArchivedCustomerMatch } from "@/features/customers/domain/duplicates";

/** Dependencias de búsqueda de duplicados. Producción usa los repositorios; los tests inyectan fakes. */
export interface CustomerDuplicatesDeps {
  findCustomerByPhone: (salonId: string, phone: string) => Promise<DuplicateCandidate | null>;
  findCustomerByEmail: (salonId: string, email: string) => Promise<DuplicateCandidate | null>;
}

const defaultCustomerDuplicatesDeps: CustomerDuplicatesDeps = {
  findCustomerByPhone,
  findCustomerByEmail,
};

export async function checkPermanentCustomerByPhone(
  salonId: string,
  phone: string,
  deps: CustomerDuplicatesDeps = defaultCustomerDuplicatesDeps
): Promise<{ exists: boolean; archived?: boolean }> {
  const trimmedPhone = normalizeOptionalPhoneInput(phone);
  if (!trimmedPhone) return { exists: false };

  const existing = await deps.findCustomerByPhone(salonId, trimmedPhone);
  if (!existing || !isPermanentCandidate(existing)) return { exists: false };

  return { exists: true, archived: !existing.is_active };
}

export async function findArchivedCustomerByContact(
  salonId: string,
  phone?: string,
  email?: string,
  deps: CustomerDuplicatesDeps = defaultCustomerDuplicatesDeps
): Promise<ArchivedCustomerMatch | null> {
  const trimmedPhone = phone ? normalizeOptionalPhoneInput(phone) : undefined;
  const trimmedEmail = email?.trim();
  if (!trimmedPhone && !trimmedEmail) return null;

  const matches = await Promise.all([
    trimmedPhone ? deps.findCustomerByPhone(salonId, trimmedPhone) : Promise.resolve(null),
    trimmedEmail ? deps.findCustomerByEmail(salonId, trimmedEmail) : Promise.resolve(null),
  ]);

  return pickArchivedMatch(matches);
}

export async function rejectArchivedDuplicate(
  salonId: string,
  input: Pick<CreateCustomerInput, "phone" | "email">,
  deps: CustomerDuplicatesDeps = defaultCustomerDuplicatesDeps
): Promise<Result<void>> {
  const match = await findArchivedCustomerByContact(
    salonId,
    input.phone ?? undefined,
    input.email ?? undefined,
    deps
  );

  if (!match) return { ok: true, value: undefined };

  return {
    ok: false,
    error: "Ya existe un cliente con esos datos. Restauralo para conservar su historial.",
  };
}
