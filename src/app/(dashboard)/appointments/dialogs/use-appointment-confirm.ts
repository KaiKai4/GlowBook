"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useSubmissionIntent } from "@/components/forms/use-submission-intent";
import { confirmAppointmentAction } from "../actions";

/**
 * Confirmación de una cita desde el detalle: envía la acción con clave de
 * idempotencia, avisa del resultado, refresca la ruta y cierra el diálogo.
 */
export function useAppointmentConfirm(appointmentId: string, onDone: () => void) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, startConfirm] = useTransition();
  const { submit } = useSubmissionIntent({ procedure: "appointments.confirm" });

  function handleConfirm() {
    startConfirm(async () => {
      const res = await submit({ appointment_id: appointmentId }, (idempotencyKey) => {
        const fd = new FormData();
        fd.set("idempotency_key", idempotencyKey);
        fd.set("appointment_id", appointmentId);
        return confirmAppointmentAction(fd);
      });
      if (res.ok) {
        toast.success("Cita confirmada.");
        router.refresh();
        onDone();
      } else {
        toast.error(res.error ?? "No se pudo confirmar la cita.");
      }
    });
  }

  return { confirming, handleConfirm };
}
