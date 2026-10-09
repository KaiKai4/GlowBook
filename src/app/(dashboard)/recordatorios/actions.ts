"use server";

import { revalidatePath } from "next/cache";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { defineAction } from "@/app/_composition/define-action";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { recordManualReminder } from "@/features/reminders/use-cases/record-manual-reminder";
import {
  parseConfirmReminderInput,
  parseManualReminderInput,
  type ConfirmReminderFields,
  type ManualReminderFields,
} from "@/features/reminders/use-cases/reminder-input";
import type { Result } from "@/infra/result";

// markReminderSentAction conserva su guard a mano: el modulo de recordatorios del
// plan se comprueba antes del limite de peticiones, y defineAction solo sabe de
// permisos por clave. La validacion y el caso de uso viven en features/reminders.

const CONFIRM_FLOW = defineAction<ConfirmReminderFields, ConfirmReminderFields, void>({
  permission: {
    key: PERMISSIONS.APPOINTMENTS_MANAGE,
    deniedMessage: "No tienes permiso para confirmar citas.",
  },
  rateLimit: { scope: "recordatorios-confirmar", options: { max: 60, windowMs: 60_000 } },
  parse: parseConfirmReminderInput,
  run: (input, session) => confirmAppointment(input.appointmentId, session.salonId, input.idempotencyKey),
  revalidate: () => ["/recordatorios", "/appointments"],
});

// FormData: appointment_id, template_id (opcional) e idempotency_key (uuid).
export async function markReminderSentAction(formData: FormData): Promise<Result<string>> {
  const profile = await requireActiveProfile();
  const remindersEnabled = await isEffectiveSalonModuleEnabled(profile, "recordatorios");

  if (!remindersEnabled || !hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return { ok: false, error: "No tienes permiso para enviar recordatorios." };
  }

  const limited = await assertActionRateLimit(profile.id, "recordatorios-envio", { max: 60, windowMs: 60_000 });
  if (!limited.ok) return limited;

  const input = parseManualReminderInput(readManualReminderFields(formData));
  if (!input.ok) return input;

  const result = await recordManualReminder({
    salonId: profile.salon_id,
    userId: profile.id,
    ...input.value,
  });

  if (result.ok) revalidatePath("/recordatorios");
  return result;
}

// FormData: appointment_id e idempotency_key (uuid).
export async function confirmReminderAppointmentAction(formData: FormData): Promise<Result<void>> {
  return CONFIRM_FLOW({
    appointmentId: readField(formData, "appointment_id"),
    idempotencyKey: readField(formData, "idempotency_key"),
  });
}

function readManualReminderFields(formData: FormData): ManualReminderFields {
  return {
    appointmentId: readField(formData, "appointment_id"),
    templateId: readField(formData, "template_id"),
    idempotencyKey: readField(formData, "idempotency_key"),
  };
}

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
