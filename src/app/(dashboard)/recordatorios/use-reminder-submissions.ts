"use client";

import { useRef } from "react";
import { useSubmissionIntent } from "@/components/forms/use-submission-intent";
import type { Result } from "@/infra/result";
import { confirmReminderAppointmentAction, markReminderSentAction } from "./actions";

const BUSY_MESSAGE = "Espera a que termine la acción anterior.";

function buildFormData(fields: Record<string, string | undefined>, idempotencyKey: string): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value) formData.set(name, value);
  }
  formData.set("idempotency_key", idempotencyKey);
  return formData;
}

// Envíos de la vista de recordatorios con clave de idempotencia. Una sola operación a la vez:
// mientras haya una en curso, otra petición responde con un aviso en lugar de solaparse.
export function useReminderSubmissions() {
  const markIntent = useSubmissionIntent({ procedure: "reminders.mark_sent" });
  const confirmIntent = useSubmissionIntent({ procedure: "reminders.confirm" });
  const busyRef = useRef(false);

  async function runExclusive<X>(start: () => Promise<Result<X>>): Promise<Result<X>> {
    if (busyRef.current) return { ok: false, error: BUSY_MESSAGE };
    busyRef.current = true;
    try {
      return await start();
    } finally {
      busyRef.current = false;
    }
  }

  function markSent(appointmentId: string, templateId?: string): Promise<Result<string>> {
    return runExclusive(() =>
      markIntent.submit({ appointment_id: appointmentId, template_id: templateId ?? "" }, (idempotencyKey) =>
        markReminderSentAction(buildFormData({ appointment_id: appointmentId, template_id: templateId }, idempotencyKey))
      )
    );
  }

  function confirm(appointmentId: string): Promise<Result<void>> {
    return runExclusive(() =>
      confirmIntent.submit({ appointment_id: appointmentId }, (idempotencyKey) =>
        confirmReminderAppointmentAction(buildFormData({ appointment_id: appointmentId }, idempotencyKey))
      )
    );
  }

  return { markSent, confirm };
}
