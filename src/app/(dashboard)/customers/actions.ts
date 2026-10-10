"use server";

import { RATE_LIMIT_POLICIES } from "@/infra/security/rate-limit-policies";
import { defineAction, parseWithSchema } from "@/app/_composition/define-action";
import { PERMISSIONS } from "@/features/access";
import {
  ArchivedCustomerLookupSchema,
  CreateCustomerSchema,
  CustomerPhoneLookupSchema,
  UpdateCustomerSchema,
  type ArchivedCustomerLookupInput,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/features/customers/schemas";
import {
  checkPermanentCustomerByPhone,
  findArchivedCustomerByContact,
  type ArchivedCustomerMatch,
} from "@/features/customers/use-cases/customer-duplicates";
import { createCustomerProfile } from "@/features/customers/use-cases/customer-profile";
import { updateCustomerProfile } from "@/features/customers/use-cases/customer-profile";
import { archiveCustomer, reactivateCustomer } from "@/features/customers/use-cases/customer-lifecycle";
import { err, ok, type Result } from "@/infra/result";
import { parseUuid } from "@/infra/validation/route-id";

// Las acciones solo orquestan: contexto, permiso por clave, rate limit, validacion
// y UNA llamada a un caso de uso (defineAction). Las reglas viven en los casos de uso.

const CUSTOMERS_RATE_LIMIT = { scope: "customers", options: RATE_LIMIT_POLICIES.write };
const CUSTOMERS_DENIED = "No tienes permiso para gestionar clientes.";
const INVALID_ID_MESSAGE = "Identificador inválido.";
const CUSTOMER_PATHS = ["/customers"] as const;
const CUSTOMER_FLOW_PATHS = ["/customers", "/appointments/new"] as const;

const parseCreateCustomer = parseWithSchema(CreateCustomerSchema);
const parseUpdateCustomer = parseWithSchema(UpdateCustomerSchema);
const parseCustomerPhone = parseWithSchema(CustomerPhoneLookupSchema);
const parseArchivedLookup = parseWithSchema(ArchivedCustomerLookupSchema);

function parseCustomerId(customerId: string): Result<string> {
  const id = parseUuid(customerId);
  return id ? ok(id) : err(INVALID_ID_MESSAGE);
}

const createCustomerFlow = defineAction<FormData, CreateCustomerInput, string>({
  permission: { key: PERMISSIONS.CUSTOMERS_MANAGE, deniedMessage: CUSTOMERS_DENIED },
  rateLimit: CUSTOMERS_RATE_LIMIT,
  parse: (formData) => parseCreateCustomer(Object.fromEntries(formData)),
  run: (input, session) => createCustomerProfile(session.salonId, input),
  revalidate: () => CUSTOMER_PATHS,
});

const checkCustomerPhoneFlow = defineAction<string, string, { exists: boolean; archived?: boolean }>({
  permission: { key: PERMISSIONS.CUSTOMERS_MANAGE, deniedMessage: CUSTOMERS_DENIED },
  rateLimit: CUSTOMERS_RATE_LIMIT,
  parse: parseCustomerPhone,
  run: async (phone, session) => ok(await checkPermanentCustomerByPhone(session.salonId, phone)),
});

const findArchivedCustomerFlow = defineAction<
  { phone?: string; email?: string },
  ArchivedCustomerLookupInput,
  ArchivedCustomerMatch | null
>({
  permission: { key: PERMISSIONS.CUSTOMERS_MANAGE, deniedMessage: CUSTOMERS_DENIED },
  rateLimit: CUSTOMERS_RATE_LIMIT,
  parse: parseArchivedLookup,
  run: async ({ phone, email }, session) =>
    ok(await findArchivedCustomerByContact(session.salonId, phone, email)),
});

const reactivateCustomerFlow = defineAction<string, string, void>({
  permission: { key: PERMISSIONS.CUSTOMERS_MANAGE, deniedMessage: CUSTOMERS_DENIED },
  rateLimit: CUSTOMERS_RATE_LIMIT,
  parse: parseCustomerId,
  run: (customerId, session) => reactivateCustomer(customerId, session.salonId),
  revalidate: () => CUSTOMER_FLOW_PATHS,
});

const updateCustomerFlow = defineAction<
  { customerId: string; formData: FormData },
  { customerId: string; data: UpdateCustomerInput },
  void
>({
  permission: { key: PERMISSIONS.CUSTOMERS_MANAGE, deniedMessage: CUSTOMERS_DENIED },
  rateLimit: CUSTOMERS_RATE_LIMIT,
  parse: ({ customerId, formData }) => {
    const id = parseCustomerId(customerId);
    if (!id.ok) return id;
    const data = parseUpdateCustomer(Object.fromEntries(formData));
    if (!data.ok) return data;
    return ok({ customerId: id.value, data: data.value });
  },
  run: ({ customerId, data }, session) => updateCustomerProfile(customerId, session.salonId, data),
  revalidate: () => CUSTOMER_PATHS,
});

const deleteCustomerFlow = defineAction<string, string, { outcome: "deleted" | "archived"; message: string }>({
  permission: { key: PERMISSIONS.CUSTOMERS_MANAGE, deniedMessage: CUSTOMERS_DENIED },
  rateLimit: CUSTOMERS_RATE_LIMIT,
  parse: parseCustomerId,
  run: (customerId, session) => archiveCustomer(customerId, session.salonId),
  revalidate: () => CUSTOMER_FLOW_PATHS,
});

export async function createCustomerAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  return createCustomerFlow(formData);
}

// Checks if a phone number already belongs to a permanent customer in this salon.
export async function checkCustomerPhoneAction(
  phone: string
): Promise<{ exists: boolean; archived?: boolean }> {
  const result = await checkCustomerPhoneFlow(phone);
  return result.ok ? result.value : { exists: false };
}

export async function findArchivedCustomerByContactAction(
  phone?: string,
  email?: string
): Promise<ArchivedCustomerMatch | null> {
  const result = await findArchivedCustomerFlow({ phone, email });
  return result.ok ? result.value : null;
}

export async function reactivateCustomerAction(customerId: string): Promise<Result<void>> {
  return reactivateCustomerFlow(customerId);
}

export async function updateCustomerAction(
  customerId: string,
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  return updateCustomerFlow({ customerId, formData });
}

export async function deleteCustomerAction(
  customerId: string
): Promise<Result<{ outcome: "deleted" | "archived"; message: string }>> {
  return deleteCustomerFlow(customerId);
}
