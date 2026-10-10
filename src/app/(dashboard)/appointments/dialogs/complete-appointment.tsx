"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  SAVED_WITH_WARNINGS_MESSAGE,
  useSubmissionIntent,
} from "@/components/forms/use-submission-intent";
import { cn } from "@/components/ui/cn";
import {
  calculateDiscountAmount,
  calculateFinalChargedTotal,
  clampDiscountPercentage,
  roundCurrency,
} from "@/features/appointments/domain/pricing";
import type { PaymentMethodOption } from "@/features/payments/domain/payment-methods";
import { completeAppointmentAction } from "../actions";
import { CheckCircle2 } from "lucide-react";
import { ChargedItemsSection } from "./complete-appointment-items";
import { CompleteAppointmentTotal } from "./complete-appointment-total";
import { CompleteAppointmentPaymentFields } from "./complete-appointment-payment-fields";
import { launchCompletionConfetti } from "./launch-completion-confetti";

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
  const { submit } = useSubmissionIntent({
    procedure: "appointments.complete",
    onWarnings: () => toast.warning(SAVED_WITH_WARNINGS_MESSAGE),
  });
  // Lo reporta el formulario (su estado de transición): el estado del hook llega dentro de
  // una transición y no se pinta hasta que la acción termina.
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Completar cita"
      className="max-w-lg"
      dismissible={!busy}
    >
      <CompleteAppointmentForm
        key={appt.id}
        appt={appt}
        onClose={onClose}
        paymentMethodOptions={paymentMethodOptions}
        submitIntent={submit}
        onBusyChange={setBusy}
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
  onBusyChange,
}: {
  appt: AppointmentForCompletion;
  onClose: () => void;
  paymentMethodOptions: PaymentMethodOption[];
  submitIntent: ReturnType<typeof useSubmissionIntent>["submit"];
  onBusyChange: (busy: boolean) => void;
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
  useEffect(() => {
    onBusyChange(pending);
  }, [pending, onBusyChange]);
  const [completed, setCompleted] = useState(false);
  // Total final que devuelve el servidor al completar; la vista previa local no lo sustituye.
  const [completedTotal, setCompletedTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const completeButtonRef = useRef<HTMLButtonElement>(null);

  // Vista previa: estos importes solo orientan al usuario antes de cobrar. El servidor
  // recalcula precios y descuentos al completar, y es su resultado el que cuenta.
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
      // El resultado del cobro lo confirma el servidor: su total final sustituye a la vista previa.
      if (res.ok) {
        setCompletedTotal(res.value.total_price);
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
        <CompleteAppointmentTotal
          subtotal={subtotal}
          discountAmount={discountAmount}
          finalTotal={completedTotal ?? finalTotal}
          completed={completed}
        />

        <ChargedItemsSection
          chargedItems={chargedItems}
          itemPrices={itemPrices}
          itemDiscounts={itemDiscounts}
          setItemPrices={setItemPrices}
          setItemDiscounts={setItemDiscounts}
          subtotal={subtotal}
          discountAmount={discountAmount}
          finalTotal={finalTotal}
        />

        <CompleteAppointmentPaymentFields
          payment={payment}
          onPaymentChange={setPayment}
          paymentMethodOptions={paymentMethodOptions}
          note={completionPriceNote}
          onNoteChange={setCompletionPriceNote}
        />

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
