"use server";

import { RATE_LIMIT_POLICIES } from "@/infra/security/rate-limit-policies";
import { defineAction } from "@/app/_composition/define-action";
import { PERMISSIONS } from "@/features/access";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { recordManualReminder } from "@/features/reminders/use-cases/record-manual-reminder";
import {
  parseConfirmReminderInput,
  parseManualReminderInput,
  type ConfirmReminderFields,
  type ManualReminderFields,
  type ManualReminderInput,
} from "@/features/reminders/use-cases/reminder-input";
import type { Result } from "@/infra/result";

// El permiso reminders.send ya exige los modulos "recordatorios" y "plantillas"
// (PERMISSION_FEATURES), asi que defineAction cubre el modulo del plan sin guard manual.
// La validacion y el caso de uso viven en features/reminders.

const CONFIRM_FLOW = defineAction<ConfirmReminderFields, ConfirmReminderFields, void>({
  permission: {
    key: PERMISSIONS.APPOINTMENTS_MANAGE,
    deniedMessage: "No tienes permiso para confirmar citas.",
  },
  rateLimit: { scope: "recordatorios-confirmar", options: RATE_LIMIT_POLICIES.write },
  parse: parseConfirmReminderInput,
  run: (input, session) => confirmAppointment(input.appointmentId, session.salonId, input.idempotencyKey),
  revalidate: () => ["/recordatorios", "/appointments"],
});

const SEND_FLOW = defineAction<FormData, ManualReminderInput, string>({
  permission: {
    key: PERMISSIONS.REMINDERS_SEND,
    deniedMessage: "No tienes permiso para enviar recordatorios.",
  },
  rateLimit: { scope: "recordatorios-envio", options: RATE_LIMIT_POLICIES.write },
  parse: (formData) => parseManualReminderInput(readManualReminderFields(formData)),
  run: (input, session) =>
    recordManualReminder({ salonId: session.salonId, userId: session.userId, ...input }),
  revalidate: () => ["/recordatorios"],
});

// FormData: appointment_id, template_id (opcional) e idempotency_key (uuid).
export async function markReminderSentAction(formData: FormData): Promise<Result<string>> {
  return SEND_FLOW(formData);
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
