"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/dates";
import { completeAppointmentAction } from "../actions";
import { CheckCircle2, Tag } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ApptForComplete {
  id: string;
  total_price: number | string | null;
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
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const rawTotal = Number(appt.total_price ?? 0);
  const discountPct = showDiscount ? Math.min(100, Math.max(0, parseFloat(discountInput) || 0)) : 0;
  const discountAmount = rawTotal * (discountPct / 100);
  const finalTotal = rawTotal - discountAmount;

  function handleComplete() {
    setError(null);
    const fd = new FormData();
    fd.set("appointment_id", appt.id);
    fd.set("payment_method", payment);
    fd.set("discount_percentage", discountPct.toString());
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
          {discountPct > 0 ? (
            <>
              <p className="text-lg font-semibold text-emerald-400 line-through">
                {formatCurrency(rawTotal)}
              </p>
              <p className="text-3xl font-bold text-emerald-700">
                {formatCurrency(finalTotal)}
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                Descuento {discountPct}% — ahorro {formatCurrency(discountAmount)}
              </p>
            </>
          ) : (
            <p className="text-3xl font-bold text-emerald-700">
              {formatCurrency(rawTotal)}
            </p>
          )}
        </div>

        {/* Discount toggle */}
        <div className="rounded-xl border border-stone-200 overflow-hidden">
          <button
            type="button"
            onClick={() => { setShowDiscount((v) => !v); setDiscountInput(""); }}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors",
              showDiscount
                ? "bg-brand-50 text-brand-700"
                : "bg-white text-stone-700 hover:bg-stone-50"
            )}
          >
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Hacer descuento
            </div>
            <div className={cn(
              "h-5 w-9 rounded-full transition-colors relative",
              showDiscount ? "bg-brand-500" : "bg-stone-200"
            )}>
              <div className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                showDiscount ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
          </button>

          {showDiscount && (
            <div className="px-4 pb-4 pt-2 bg-brand-50 border-t border-brand-100">
              <label className="text-xs font-medium text-brand-700 block mb-1.5">
                Porcentaje de descuento
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="0"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="h-10 w-full rounded-lg border border-brand-200 bg-white px-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <span className="text-sm font-bold text-brand-700 shrink-0">%</span>
              </div>
            </div>
          )}
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
