import { err, ok, type Result } from "@/infra/result";
import { parseUuid } from "@/infra/validation/route-id";

// Validacion de identificadores de los recordatorios manuales y de la
// confirmacion desde la agenda. Sin I/O: los casos de uso solo persisten.

const INVALID_ID_MESSAGE = "Identificador inválido.";
const INVALID_KEY_MESSAGE = "Solicitud inválida. Recarga la página e inténtalo de nuevo.";

export interface ManualReminderFields {
  appointmentId: string;
  templateId: string;
  idempotencyKey: string;
}

export interface ManualReminderInput {
  appointmentId: string;
  templateId: string | undefined;
  idempotencyKey: string;
}

export interface ConfirmReminderFields {
  appointmentId: string;
  idempotencyKey: string;
}

export function parseManualReminderInput(fields: ManualReminderFields): Result<ManualReminderInput> {
  // Una cadena vacia de plantilla equivale a no enviar plantilla.
  const templateId = fields.templateId || undefined;

  if (!parseUuid(fields.appointmentId)) return err(INVALID_ID_MESSAGE);
  if (templateId !== undefined && !parseUuid(templateId)) return err(INVALID_ID_MESSAGE);
  if (!parseUuid(fields.idempotencyKey)) return err(INVALID_KEY_MESSAGE);

  return ok({ appointmentId: fields.appointmentId, templateId, idempotencyKey: fields.idempotencyKey });
}

export function parseConfirmReminderInput(fields: ConfirmReminderFields): Result<ConfirmReminderFields> {
  if (!parseUuid(fields.appointmentId)) return err(INVALID_ID_MESSAGE);
  if (!parseUuid(fields.idempotencyKey)) return err(INVALID_KEY_MESSAGE);

  return ok({ appointmentId: fields.appointmentId, idempotencyKey: fields.idempotencyKey });
}
