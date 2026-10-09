import {
  CompleteAppointmentSchema,
  CreateAppointmentSchema,
  UpdateAppointmentScheduleSchema,
  type CompleteAppointmentInput,
  type CreateAppointmentInput,
  type UpdateAppointmentScheduleInput,
} from "@/features/appointments/schemas";
import { err, ok, type Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";

// Lectura de los formularios de citas: los campos JSON (servicios y cobros) se
// parsean aqui y el resto se valida con los schemas del modulo. Las acciones solo
// orquestan: leen el FormData, llaman a esta funcion y despues al caso de uso.

const INVALID_SERVICES_MESSAGE = "Datos de servicios invalidos.";
const INVALID_CHARGES_MESSAGE = "Cobros de servicios invalidos.";

type RawForm = Record<string, FormDataEntryValue>;

function parseJsonField(value: unknown, message: string): Result<unknown> {
  try {
    return ok(JSON.parse(String(value)));
  } catch {
    return err(message);
  }
}

export function parseCreateAppointmentForm(form: RawForm): Result<CreateAppointmentInput> {
  const assignments = parseJsonField(form.assignments, INVALID_SERVICES_MESSAGE);
  if (!assignments.ok) return assignments;

  const parsed = CreateAppointmentSchema.safeParse({ ...form, assignments: assignments.value });
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  return ok(parsed.data);
}

export function parseUpdateAppointmentScheduleForm(form: RawForm): Result<UpdateAppointmentScheduleInput> {
  const assignments = parseJsonField(form.assignments, INVALID_SERVICES_MESSAGE);
  if (!assignments.ok) return assignments;

  const parsed = UpdateAppointmentScheduleSchema.safeParse({ ...form, assignments: assignments.value });
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  return ok(parsed.data);
}

/**
 * Lee y valida el formulario de completar cita (sin consultar el salon: que el
 * metodo de pago este habilitado es una regla del caso de uso).
 */
export function parseCompleteAppointmentForm(formData: FormData): Result<CompleteAppointmentInput> {
  const itemCharges = parseJsonField(formData.get("item_charges") ?? "[]", INVALID_CHARGES_MESSAGE);
  if (!itemCharges.ok) return itemCharges;

  const parsed = CompleteAppointmentSchema.safeParse({
    appointment_id: formData.get("appointment_id"),
    idempotency_key: formData.get("idempotency_key"),
    payment_method: formData.get("payment_method"),
    completion_price_note: formData.get("completion_price_note") ?? "",
    item_charges: itemCharges.value,
  });
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  return ok(parsed.data);
}
