"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  SAVED_WITH_WARNINGS_MESSAGE,
  useSubmissionIntent,
} from "@/components/forms/use-submission-intent";
import { formatCurrency } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import {
  calculateDiscountAmount,
  calculateFinalChargedTotal,
  clampDiscountPercentage,
  roundCurrency,
} from "@/features/appointments/domain/pricing";
import type {
  PaymentMethod,
  PaymentMethodOption,
} from "@/features/payments/domain/payment-methods";
import { completeAppointmentAction } from "../actions";
import { CheckCircle2, Tag } from "lucide-react";

export interface AppointmentForCompletion {
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

export function CompleteAppointmentDialog({
  appt, open, onClose, paymentMethodOptions,
}: {
  appt: AppointmentForCompletion;
  open: boolean;
  onClose: () => void;
  paymentMethodOptions: PaymentMethodOption[];
}) {
  const toast = useToast();
  const intent = useSubmissionIntent({
    procedure: "appointments.complete",
    onWarnings: () => toast.warning(SAVED_WITH_WARNINGS_MESSAGE),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Completar cita"
      className="max-w-lg"
      dismissible={!intent.pending}
    >
      <CompleteAppointmentForm
        key={appt.id}
        appt={appt}
        onClose={onClose}
        paymentMethodOptions={paymentMethodOptions}
        submitIntent={intent.submit}
      />
    </Dialog>
  );
}

function buildInitialItemPrices(appt: AppointmentForCompletion) {
  return Object.fromEntries(
    appt.items.map((item) => [item.id, String(Number(item.price ?? 0))])
  );
}

function buildInitialItemDiscounts(appt: AppointmentForCompletion) {
  return Object.fromEntries(appt.items.map((item) => [item.id, ""]));
}

function CompleteAppointmentForm({
  appt,
  onClose,
  paymentMethodOptions,
  submitIntent,
}: {
  appt: AppointmentForCompletion;
  onClose: () => void;
  paymentMethodOptions: PaymentMethodOption[];
  submitIntent: ReturnType<typeof useSubmissionIntent>["submit"];
}) {
  const router = useRouter();
  const [payment, setPayment] = useState(paymentMethodOptions[0]?.value ?? "cash");
  const [itemPrices, setItemPrices] = useState<Record<string, string>>(() =>
    buildInitialItemPrices(appt)
  );
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, string>>(() =>
    buildInitialItemDiscounts(appt)
  );
  const [completionPriceNote, setCompletionPriceNote] = useState("");
  const [pending, start] = useTransition();
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completeButtonRef = useRef<HTMLButtonElement>(null);

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

  function handleComplete() {
    if (pending || completed) return;
    setError(null);
    const itemCharges = JSON.stringify(
      chargedItems.map((item) => ({
        id: item.id,
        price: item.price,
        discountPercentage: item.discountPercentage,
      }))
    );

    start(async () => {
      const res = await submitIntent(
        {
          appointment_id: appt.id,
          payment_method: payment,
          completion_price_note: completionPriceNote,
          item_charges: itemCharges,
        },
        (idempotencyKey) => {
          const fd = new FormData();
          fd.set("idempotency_key", idempotencyKey);
          fd.set("appointment_id", appt.id);
          fd.set("payment_method", payment);
          fd.set("completion_price_note", completionPriceNote);
          fd.set("item_charges", itemCharges);
          return completeAppointmentAction(null, fd);
        }
      );
      if (res.ok) {
        setCompleted(true);
        await launchCompletionConfetti(completeButtonRef.current);
        router.refresh();
        window.setTimeout(onClose, 700);
      } else {
        setError(res.error ?? "Error al completar la cita.");
      }
    });
  }

  return (
    <div className="space-y-5">
        <div className="rounded-2xl border border-success-border bg-success-subtle px-5 py-5 text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-success-fg">
            Total cobrado
          </p>
          {discountAmount > 0 ? (
            <>
              <p className="text-sm font-semibold text-success-fg line-through">
                {formatCurrency(subtotal)}
              </p>
              <p className="text-2xl font-semibold tracking-tight text-success-strong">
                {formatCurrency(finalTotal)}
              </p>
              <p className="mt-1 text-xs font-medium text-success-fg">
                Descuento aplicado: {formatCurrency(discountAmount)}
              </p>
            </>
          ) : (
            <p className="text-2xl font-semibold tracking-tight text-success-strong">
              {formatCurrency(finalTotal)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Servicios cobrados
          </p>

          <div className="space-y-2">
            {chargedItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-surface px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_216px] sm:items-end">
                  <div className="min-w-0 self-start">
                    <p className="truncate text-sm font-semibold text-fg-secondary">
                      {item.service?.name ?? "Servicio"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="block text-xs font-semibold uppercase text-fg-subtle">
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
                          "h-10 w-full rounded-xl border px-3 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500",
                          item.isVariable
                            ? "border-brand-200 bg-surface text-fg"
                            : "border-border bg-surface-muted text-fg-subtle"
                        )}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="block text-xs font-semibold uppercase text-fg-subtle">
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
                        className="h-10 w-full rounded-xl border border-brand-200 bg-surface px-3 text-right text-sm font-semibold text-fg focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </label>
                  </div>
                </div>

                {item.discountAmount > 0 && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-success-subtle px-3 py-2 text-xs text-success-fg">
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

          <div className="rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm">
            <div className="flex items-center justify-between text-fg-muted">
              <span>Subtotal servicios</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="mt-1 flex items-center justify-between text-success-fg">
                <span>Descuentos por servicio</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-semibold text-fg">
              <span>Total cobrado</span>
              <span>{formatCurrency(finalTotal)}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <Select
            label="Metodo de pago"
            value={payment}
            onChange={(event) => setPayment(event.target.value as PaymentMethod)}
          >
            {paymentMethodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-fg-secondary">
              Nota del cobro (opcional)
            </label>
            <textarea
              value={completionPriceNote}
              onChange={(event) => setCompletionPriceNote(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ej. promocion, ajuste manual o servicio adicional..."
              className="w-full resize-none rounded-xl border border-border px-3 py-2 text-sm text-fg-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-strong">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button
            variant="ghost"
            className="flex-1"
            disabled={pending || completed}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            ref={completeButtonRef}
            variant="primary"
            className={cn(
              "flex-1 transition-[background-color,transform] duration-200 disabled:opacity-100",
              completed && "bg-success-solid hover:bg-success-solid"
            )}
            loading={pending && !completed}
            disabled={completed}
            onClick={handleComplete}
          >
            <CheckCircle2 className="h-4 w-4" />
            {completed ? "Cita completada" : "Cobrar y completar"}
          </Button>
        </div>
    </div>
  );
}

async function launchCompletionConfetti(button: HTMLButtonElement | null) {
  if (!button || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  try {
    const { default: confetti } = await import("canvas-confetti");
    const rect = button.getBoundingClientRect();
    const computedStyles = window.getComputedStyle(button);
    const brandColor =
      computedStyles.getPropertyValue("--color-brand-600").trim() || "#7C3AED";
    const origin = {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    };

    confetti({
      particleCount: 90,
      spread: 72,
      startVelocity: 38,
      gravity: 0.92,
      scalar: 0.82,
      ticks: 180,
      origin,
      colors: [brandColor, "#22C55E", "#38BDF8", "#FACC15", "#F472B6"],
      disableForReducedMotion: true,
      zIndex: 100,
    });
  } catch {
    // Completing the appointment must not depend on the decorative effect.
  }
}
