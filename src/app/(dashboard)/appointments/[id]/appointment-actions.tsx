"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  cancelAppointmentAction,
  confirmAppointmentAction,
} from "../actions";
import { CompleteAppointmentDialog } from "../dialogs/complete-appointment";

interface AppointmentForComplete {
  id: string;
  total_price: number | string | null;
  customer: { first_name: string; last_name: string } | null;
  items: Array<{
    id: string;
    price: number;
    discount_amount?: number;
    service: {
      name: string;
      category: { name: string; pricing_mode: "fixed" | "variable" } | null;
    } | null;
  }>;
}

export function AppointmentActions({
  appointmentId,
  appointment,
  status,
}: {
  appointmentId: string;
  appointment: AppointmentForComplete;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  }

  const isClosed = ["completed", "cancelled", "no_show"].includes(status);

  if (isClosed) {
    return <p className="text-sm text-neutral-400">Esta cita ya está cerrada.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "scheduled" && (
          <Button
            variant="outline"
            loading={pending}
            onClick={() => run(() => confirmAppointmentAction(appointmentId))}
          >
            Confirmar
          </Button>
        )}
        <Button
          variant="primary"
          disabled={pending}
          onClick={() => setCompleteOpen(true)}
        >
          Completar
        </Button>
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => run(() => cancelAppointmentAction(appointmentId))}
        >
          Cancelar cita
        </Button>
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <CompleteAppointmentDialog
        appt={appointment}
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
      />
    </div>
  );
}
