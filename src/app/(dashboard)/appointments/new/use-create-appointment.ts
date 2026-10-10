"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  SAVED_WITH_WARNINGS_MESSAGE,
  useSubmissionIntent,
} from "@/components/forms/use-submission-intent";
import { zonedWallTimeToUtc } from "@/infra/format/dates";
import type { AppointmentServiceRow } from "@/features/appointments/domain/wizard-availability";
import { createAppointmentAction } from "../actions";

export interface CreateAppointmentDraft {
  mode: "existing" | "new";
  customerId: string;
  newFirst: string;
  newLast: string;
  newPhone: string;
  date: string;
  time: string;
  timezone: string;
  rows: AppointmentServiceRow[];
  notes: string;
}

function newCustomerPayload(draft: CreateAppointmentDraft) {
  const phone = draft.newPhone.trim();
  return {
    first_name: draft.newFirst,
    last_name: draft.newLast,
    ...(phone ? { phone } : {}),
  };
}

export function useCreateAppointment() {
  const router = useRouter();
  const toast = useToast();
  const { submit } = useSubmissionIntent({
    procedure: "appointments.create",
    onWarnings: () => toast.warning(SAVED_WITH_WARNINGS_MESSAGE),
  });
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  function confirm(draft: CreateAppointmentDraft) {
    setSubmitError(null);

    startSubmit(async () => {
      // Wall-clock time in the salon timezone, never the browser's local zone.
      const startTime = zonedWallTimeToUtc(draft.date, draft.time, draft.timezone).toISOString();
      const assignments = JSON.stringify(
        draft.rows.map((row) => ({ service_id: row.serviceId, employee_id: row.employeeId }))
      );
      // Cliente nuevo: viaja dentro de la cita. Una sola accion: si la cita falla, no queda cliente huerfano.
      const customer =
        draft.mode === "new"
          ? { new_customer: newCustomerPayload(draft) }
          : { customer_id: draft.customerId };

      const result = await submit(
        { ...customer, start_time: startTime, notes: draft.notes, assignments },
        (idempotencyKey) => {
          const formData = new FormData();
          formData.set("idempotency_key", idempotencyKey);
          if (draft.mode === "new") {
            formData.set("new_customer", JSON.stringify(newCustomerPayload(draft)));
          } else {
            formData.set("customer_id", draft.customerId);
          }
          formData.set("start_time", startTime);
          formData.set("notes", draft.notes);
          formData.set("assignments", assignments);
          return createAppointmentAction(null, formData);
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

  return { confirm, submitting, submitError };
}
