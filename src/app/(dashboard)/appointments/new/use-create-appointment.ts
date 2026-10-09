"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  SAVED_WITH_WARNINGS_MESSAGE,
  useSubmissionIntent,
} from "@/components/forms/use-submission-intent";
import { zonedWallTimeToUtc } from "@/lib/utils/dates";
import type { AppointmentServiceRow } from "@/features/appointments/domain/wizard-availability";
import { createAppointmentAction } from "../actions";
import { findOrCreateCustomerAction } from "../../customers/actions";

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
      let customerId = draft.customerId;

      if (draft.mode === "new") {
        const customerResult = await findOrCreateCustomerAction(
          draft.newFirst,
          draft.newLast,
          draft.newPhone || undefined
        );
        if (!customerResult.ok) {
          setSubmitError(customerResult.error);
          return;
        }
        customerId = customerResult.value;
      }

      // Wall-clock time in the salon timezone, never the browser's local zone.
      const startTime = zonedWallTimeToUtc(draft.date, draft.time, draft.timezone).toISOString();
      const assignments = JSON.stringify(
        draft.rows.map((row) => ({ service_id: row.serviceId, employee_id: row.employeeId }))
      );

      const result = await submit(
        { customer_id: customerId, start_time: startTime, notes: draft.notes, assignments },
        (idempotencyKey) => {
          const formData = new FormData();
          formData.set("idempotency_key", idempotencyKey);
          formData.set("customer_id", customerId);
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
