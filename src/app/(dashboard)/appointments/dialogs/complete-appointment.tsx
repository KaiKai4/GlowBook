"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import {
  calculateDiscountAmount,
  calculateFinalChargedTotal,
  clampDiscountPercentage,
  roundCurrency,
} from "@/features/appointments/domain/pricing";
import { completeAppointmentAction } from "../actions";
import { CheckCircle2, LockKeyhole, PencilLine, Tag } from "lucide-react";

interface ApptForComplete {
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
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({});
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, string>>({});
  const [completionPriceNote, setCompletionPriceNote] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItemPrices(
      Object.fromEntries(appt.items.map((item) => [item.id, String(Number(item.price ?? 0))]))
    );
    setItemDiscounts(Object.fromEntries(appt.items.map((item) => [item.id, ""])));
    setCompletionPriceNote("");
    setError(null);
  }, [appt.id, appt.items]);

  const chargedItems = useMemo(
    () =>
      appt.items.map((item) => {
        const price = roundCurrency(Number(itemPrices[item.id] ?? item.price ?? 0));
        const discountPercentage = clampDiscountPercentage(
          parseFloat(itemDiscounts[item.id] || "0") || 0
        );
        const discountAmount = calculateDiscountAmount(price, discountPercentage);
        const finalPrice = calculateFinalChargedTotal(price, discountAmount);
        const isVariable = item.service?.category?.pricing_mode === "variable";
        return { ...item, price, discountPercentage, discountAmount, finalPrice, isVariable };
      }),
    [appt.items, itemDiscounts, itemPrices]
  );
  const subtotal = roundCurrency(chargedItems.reduce((sum, item) => sum + item.price, 0));
  const discountAmount = roundCurrency(
    chargedItems.reduce((sum, item) => sum + item.discountAmount, 0)
  );
  const finalTotal = calculateFinalChargedTotal(subtotal, discountAmount);
  const hasVariableItems = chargedItems.some((item) => item.isVariable);

  function handleComplete() {
    setError(null);
    const fd = new FormData();
    fd.set("appointment_id", appt.id);
    fd.set("payment_method", payment);
    fd.set("completion_price_note", completionPriceNote);
    fd.set(
      "item_charges",
      JSON.stringify(
        chargedItems.map((item) => ({
          id: item.id,
          price: item.price,
          discountPercentage: item.discountPercentage,
        }))
      )
    );

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
      description={`Registra el metodo de pago de ${customerName}`}
      className="max-w-lg"
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
          <p className="mb-1 text-xs font-medium text-emerald-600">Total cobrado final</p>
          {discountAmount > 0 ? (
            <>
              <p className="text-lg font-semibold text-emerald-400 line-through">
                {formatCurrency(subtotal)}
              </p>
              <p className="text-3xl font-bold text-emerald-700">
                {formatCurrency(finalTotal)}
              </p>
              <p className="mt-1 text-xs text-emerald-600">
                Descuento en servicios - ahorro {formatCurrency(discountAmount)}
              </p>
            </>
          ) : (
            <p className="text-3xl font-bold text-emerald-700">
              {formatCurrency(finalTotal)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
              Servicios cobrados
            </p>
            {hasVariableItems && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                precio revisable
              </span>
            )}
          </div>

          <div className="space-y-2">
            {chargedItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-stone-200 bg-white px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-800">
                      {item.service?.name ?? "Servicio"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                      {item.isVariable ? (
                        <>
                          <PencilLine className="h-3 w-3 text-brand-500" />
                          Precio editable al cobrar
                        </>
                      ) : (
                        <>
                          <LockKeyhole className="h-3 w-3 text-stone-400" />
                          Precio fijo
                        </>
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-[112px_96px] gap-2">
                    <label className="space-y-1">
                      <span className="block text-[10px] font-semibold uppercase text-stone-400">
                        Precio
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={itemPrices[item.id] ?? ""}
                        disabled={!item.isVariable}
                        onChange={(event) =>
                          setItemPrices((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        className={cn(
                          "h-9 w-full rounded-lg border px-3 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500",
                          item.isVariable
                            ? "border-brand-200 bg-white text-stone-900"
                            : "border-stone-200 bg-stone-50 text-stone-500"
                        )}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="block text-[10px] font-semibold uppercase text-stone-400">
                        Desc. %
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        placeholder="0"
                        value={itemDiscounts[item.id] ?? ""}
                        onChange={(event) =>
                          setItemDiscounts((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-brand-200 bg-white px-3 text-right text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </label>
                  </div>
                </div>

                {item.discountAmount > 0 && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Tag className="h-3 w-3" />
                      Promocion aplicada solo a este servicio
                    </span>
                    <span>
                      -{formatCurrency(item.discountAmount)} = {formatCurrency(item.finalPrice)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-1 border-t border-stone-100 pt-3 text-sm">
            <div className="flex items-center justify-between font-semibold text-stone-700">
              <span>Subtotal servicios</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-emerald-700">
                <span>Descuentos por servicio</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between font-bold text-stone-900">
              <span>Total cobrado</span>
              <span>{formatCurrency(finalTotal)}</span>
            </div>
          </div>
        </div>

        <Select
          label="Metodo de pago"
          value={payment}
          onChange={(event) => setPayment(event.target.value)}
        >
          {PAYMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-stone-600">
            Motivo del ajuste o descuento (opcional)
          </label>
          <textarea
            value={completionPriceNote}
            onChange={(event) => setCompletionPriceNote(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Ej. promocion de lunes, diseno adicional, cabello largo..."
            className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
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
