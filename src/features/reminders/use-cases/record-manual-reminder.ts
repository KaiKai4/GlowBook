import "server-only";
import { captureError } from "@/infra/observability";

import { getAppointmentReminderTarget } from "@/features/appointments";
import {
  createManualReminderLog,
  findManualReminderSentAt,
  ReminderLogDuplicateError,
} from "../data/reminder-log.repo";
import type { Result } from "@/infra/result";

const FAILED_MESSAGE = "No se pudo marcar el recordatorio como enviado.";

export async function recordManualReminder(input: {
  salonId: string;
  appointmentId: string;
  templateId?: string;
  userId: string;
  idempotencyKey: string;
}): Promise<Result<string>> {
  const appointment = await getAppointmentReminderTarget(input.appointmentId, input.salonId);

  if (!appointment || appointment.salonId !== input.salonId) {
    return { ok: false, error: "Cita no encontrada." };
  }

  try {
    const sentAt = await createManualReminderLog({
      salonId: input.salonId,
      appointmentId: input.appointmentId,
      templateId: input.templateId,
      recipientPhone: appointment.customerPhone,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
    });

    return { ok: true, value: sentAt };
  } catch (error) {
    if (error instanceof ReminderLogDuplicateError) {
      // Doble envío con la misma clave: devuelve el registro existente en vez de duplicarlo.
      return recordExistingReminder({
        salonId: input.salonId,
        appointmentId: input.appointmentId,
        idempotencyKey: input.idempotencyKey,
      });
    }
    captureError(error, { module: "reminders", action: "manual" });
    return { ok: false, error: FAILED_MESSAGE };
  }
}

async function recordExistingReminder(input: {
  salonId: string;
  appointmentId: string;
  idempotencyKey: string;
}): Promise<Result<string>> {
  try {
    const sentAt = await findManualReminderSentAt(input);
    if (sentAt) return { ok: true, value: sentAt };
  } catch (error) {
    captureError(error, { module: "reminders", action: "manual-duplicate" });
  }
  return { ok: false, error: FAILED_MESSAGE };
}
