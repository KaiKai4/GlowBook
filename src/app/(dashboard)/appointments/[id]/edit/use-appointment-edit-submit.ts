"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SAVED_WITH_WARNINGS_MESSAGE,
  useSubmissionIntent,
} from "@/components/forms/use-submission-intent";
import { useToast } from "@/components/ui/toast";
import { zonedWallTimeToUtc } from "@/infra/format/dates";
import type { AppointmentServiceRow } from "@/features/appointments/domain/wizard-availability";
import type { AppointmentDetailViewModel } from "@/features/appointments";
import { updateAppointmentScheduleAction } from "../../actions";

interface UseAppointmentEditSubmitOptions {
  appointment: AppointmentDetailViewModel;
  date: string;
  time: string;
  notes: string;
  rows: AppointmentServiceRow[];
}

/** Guarda el nuevo horario y servicios de la cita con intención de envío idempotente. */
export function useAppointmentEditSubmit({
  appointment,
  date,
  time,
  notes,
  rows,
}: UseAppointmentEditSubmitOptions) {
  const router = useRouter();
  const toast = useToast();
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { submit: submitIntent } = useSubmissionIntent({
    procedure: "appointments.update-schedule",
    onWarnings: () => toast.warning(SAVED_WITH_WARNINGS_MESSAGE),
  });

  function submit() {
    setSubmitError(null);

    startSubmit(async () => {
      const startTime = zonedWallTimeToUtc(date, time, appointment.timezone).toISOString();
      const assignments = JSON.stringify(rows.map((row) => ({
        service_id: row.serviceId,
        employee_id: row.employeeId,
      })));

      const result = await submitIntent(
        { appointment_id: appointment.id, start_time: startTime, notes, assignments },
        (idempotencyKey) => {
          const formData = new FormData();
          formData.set("idempotency_key", idempotencyKey);
          formData.set("appointment_id", appointment.id);
          formData.set("start_time", startTime);
          formData.set("notes", notes);
          formData.set("assignments", assignments);
          return updateAppointmentScheduleAction(null, formData);
        }
      );
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      router.push("/appointments");
      router.refresh();
    });
  }

  return { submit, submitting, submitError, setSubmitError };
}
