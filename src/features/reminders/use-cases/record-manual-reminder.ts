import "server-only";

import { findAppointmentById } from "@/features/appointments/data/appointments.repo";
import { createManualReminderLog } from "../data/reminder-log.repo";
import type { Result } from "@/lib/result";

export async function recordManualReminder(input: {
  salonId: string;
  appointmentId: string;
  templateId?: string;
  userId: string;
}): Promise<Result<string>> {
  const appointment = await findAppointmentById(input.appointmentId);

  if (!appointment || appointment.salon_id !== input.salonId) {
    return { ok: false, error: "Cita no encontrada." };
  }

  try {
    const sentAt = await createManualReminderLog({
      salonId: input.salonId,
      appointmentId: input.appointmentId,
      templateId: input.templateId,
      recipientPhone: appointment.customer?.phone ?? undefined,
      userId: input.userId,
    });

    return { ok: true, value: sentAt };
  } catch (error) {
    console.error("[reminders:manual]", error);
    return { ok: false, error: "No se pudo marcar el recordatorio como enviado." };
  }
}
