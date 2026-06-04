import "server-only";

import { getAppointmentReminderTarget } from "@/features/appointments/use-cases/appointment-reminder-target";
import { createManualReminderLog } from "../data/reminder-log.repo";
import type { Result } from "@/lib/result";

export async function recordManualReminder(input: {
  salonId: string;
  appointmentId: string;
  templateId?: string;
  userId: string;
}): Promise<Result<string>> {
  const appointment = await getAppointmentReminderTarget(input.appointmentId);

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
    });

    return { ok: true, value: sentAt };
  } catch (error) {
    console.error("[reminders:manual]", error);
    return { ok: false, error: "No se pudo marcar el recordatorio como enviado." };
  }
}
