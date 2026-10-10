import {
  CreateEmployeeSchema,
  EmployeeIdempotencySchema,
  EmployeePatchSchema,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from "@/features/employees/schemas";
import { err, ok, type Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";
import { checkIds } from "./employee-action-guard";

// Borde de las acciones de colaboradores: lee el FormData y valida con Zod antes de
// llamar al caso de uso. El caso de uso recibe datos ya validados.

const INVALID_IDEMPOTENCY_KEY = "Solicitud inválida. Recarga la página e inténtalo de nuevo.";

export interface CreateEmployeeForm {
  idempotencyKey: string;
  /** Rol pedido en el formulario (null si no se envio). La admision del plan decide el efectivo. */
  requestedRoleId: string | null;
  data: CreateEmployeeInput;
}

export interface UpdateEmployeeRaw {
  employeeId: string;
  formData: FormData;
}

export interface UpdateEmployeeForm {
  employeeId: string;
  idempotencyKey: string;
  data: UpdateEmployeeInput;
}

function readIdempotencyKey(formData: FormData): Result<string> {
  const parsed = EmployeeIdempotencySchema.safeParse({
    idempotency_key: formData.get("idempotency_key"),
  });
  if (!parsed.success) return err(INVALID_IDEMPOTENCY_KEY);
  return ok(parsed.data.idempotency_key);
}

function requestedRoleIdOf(formData: FormData): string | null {
  const raw = formData.get("role_id");
  return typeof raw === "string" ? raw : null;
}

/** Alta: clave de idempotencia, rol pedido y formulario validado con el esquema de alta. */
export function parseCreateEmployeeForm(formData: FormData): Result<CreateEmployeeForm> {
  const key = readIdempotencyKey(formData);
  if (!key.ok) return key;
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
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  return ok({ idempotencyKey: key.value, requestedRoleId: requestedRoleIdOf(formData), data: parsed.data });
}

// Edicion: sin defaults. Un campo escalar ausente del FormData no se escribe (ni se
// rellena con ""/0); los campos presentes se validan con el esquema de edicion.
function parseUpdateData(formData: FormData): Result<UpdateEmployeeInput> {
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
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  return ok(parsed.data);
}

/** Edicion: identificador del colaborador, clave de idempotencia y formulario, en ese orden. */
export function parseUpdateEmployeeForm(raw: UpdateEmployeeRaw): Result<UpdateEmployeeForm> {
  const ids = checkIds(raw, [raw.employeeId]);
  if (!ids.ok) return ids;
  const key = readIdempotencyKey(raw.formData);
  if (!key.ok) return key;
  const data = parseUpdateData(raw.formData);
  if (!data.ok) return data;
  return ok({ employeeId: raw.employeeId, idempotencyKey: key.value, data: data.value });
}
