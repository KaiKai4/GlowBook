import { CreateEmployeeSchema, EmployeeIdempotencySchema } from "@/features/employees/schemas";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/features/employees/schemas";
import { EmployeePatchSchema } from "./employee-patch-schema";
import type { Result } from "@/lib/result";
import { firstIssueMessage } from "@/lib/validation/first-issue";

const INVALID_IDEMPOTENCY_KEY = "Solicitud inválida. Recarga la página e inténtalo de nuevo.";

// Lectura y validacion del FormData de las acciones de colaboradores. Vive aparte
// para mantener actions.ts bajo el limite de lineas (como employee-action-guard.ts).

export function readIdempotencyKey(formData: FormData): Result<string> {
  const parsed = EmployeeIdempotencySchema.safeParse({
    idempotency_key: formData.get("idempotency_key"),
  });
  if (!parsed.success) return { ok: false, error: INVALID_IDEMPOTENCY_KEY };
  return { ok: true, value: parsed.data.idempotency_key };
}

export function parseCreateEmployeeForm(formData: FormData): Result<CreateEmployeeInput> {
  const parsed = CreateEmployeeSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    specialty: formData.get("specialty") ?? "",
    commission_percentage: Number(formData.get("commission_percentage") ?? 0),
    service_ids: formData.getAll("service_ids").map(String),
    category_ids: formData.getAll("category_ids").map(String),
  });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };
  return { ok: true, value: parsed.data };
}

// Edicion: sin defaults. Un campo escalar ausente del FormData no se escribe (ni se
// rellena con ""/0); los campos presentes se validan con el esquema de edicion.
export function parseUpdateEmployeeForm(formData: FormData): Result<UpdateEmployeeInput> {
  const parsed = EmployeePatchSchema.safeParse({
    first_name: formData.get("first_name") ?? undefined,
    last_name: formData.get("last_name") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    email: formData.get("email") ?? undefined,
    specialty: formData.get("specialty") ?? undefined,
    commission_percentage: formData.get("commission_percentage")
      ? Number(formData.get("commission_percentage"))
      : undefined,
    service_ids: formData.getAll("service_ids").map(String),
    category_ids: formData.getAll("category_ids").map(String),
  });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };
  return { ok: true, value: parsed.data };
}
