"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  confirmAppointmentAction,
  cancelAppointmentAction,
  completeAppointmentAction,
} from "../actions";

export function AppointmentActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState("cash");
  const [completing, setCompleting] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  }

  function complete() {
    const fd = new FormData();
    fd.set("appointment_id", appointmentId);
    fd.set("payment_method", payment);
    run(() => completeAppointmentAction(null, fd));
  }

  const isClosed = ["completed", "cancelled", "no_show"].includes(status);

  if (isClosed) {
    return <p className="text-sm text-neutral-400">Esta cita ya está cerrada.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "scheduled" && (
          <Button variant="outline" loading={pending} onClick={() => run(() => confirmAppointmentAction(appointmentId))}>
            Confirmar
          </Button>
        )}
        {!completing ? (
          <Button variant="primary" disabled={pending} onClick={() => setCompleting(true)}>
            Completar
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-36">
              <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">Transferencia</option>
                <option value="yappy">Yappy</option>
                <option value="other">Otro</option>
              </Select>
            </div>
            <Button variant="primary" loading={pending} onClick={complete}>Cobrar y completar</Button>
            <Button variant="ghost" onClick={() => setCompleting(false)}>Cancelar</Button>
          </div>
        )}
        <Button variant="destructive" disabled={pending} onClick={() => run(() => cancelAppointmentAction(appointmentId))}>
          Cancelar cita
        </Button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
