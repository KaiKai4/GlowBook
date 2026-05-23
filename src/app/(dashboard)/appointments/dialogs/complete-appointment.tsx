"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/dates";
import { completeAppointmentAction } from "../actions";
import { CheckCircle2 } from "lucide-react";

interface ApptForComplete {
  id: string;
  total_price: string | null;
  customer: { first_name: string; last_name: string } | null;
}

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "yappy", label: "Yappy" },
  { value: "other", label: "Otro" },
];

export function CompleteAppointmentDialog({
  appt, open, onClose,
}: {
  appt: ApptForComplete;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [payment, setPayment] = useState("cash");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleComplete() {
    setError(null);
    const fd = new FormData();
    fd.set("appointment_id", appt.id);
    fd.set("payment_method", payment);
    start(async () => {
      const res = await completeAppointmentAction(null, fd);
      if (res.ok) {
        onClose();
        router.refresh();
      } else {
        setError(res.error ?? "Error al completar la cita.");
      }
    });
  }

  const customerName = appt.customer
    ? `${appt.customer.first_name} ${appt.customer.last_name}`
    : "Cliente";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Completar cita"
      description={`Registra el método de pago de ${customerName}`}
      className="max-w-sm"
    >
      <div className="space-y-5">
        {/* Total */}
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-4 text-center">
          <p className="text-xs text-emerald-600 font-medium mb-1">Total a cobrar</p>
          <p className="text-3xl font-bold text-emerald-700">
            {formatCurrency(Number(appt.total_price ?? 0))}
          </p>
        </div>

        <Select
          label="Método de pago"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
        >
          {PAYMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" className="flex-1" loading={pending} onClick={handleComplete}>
            <CheckCircle2 className="h-4 w-4" />
            Cobrar y completar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
