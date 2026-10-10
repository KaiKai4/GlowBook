"use client";

import { toAmount } from "@/infra/format/money";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { useSubmissionIntent } from "@/components/forms/use-submission-intent";
import { previewCompletionTotals } from "@/features/appointments/domain/pricing";
import type { PaymentMethodOption } from "@/features/payments/domain/payment-methods";
import { completeAppointmentAction } from "../actions";
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

function buildInitialItemPrices(appt: AppointmentForCompletion) {
  return Object.fromEntries(
    appt.items.map((item) => [item.id, String(toAmount(item.price))])
  );
}

function buildInitialItemDiscounts(appt: AppointmentForCompletion) {
  return Object.fromEntries(appt.items.map((item) => [item.id, ""]));
}

/**
 * Estado y envío del cobro de una cita: precios y descuentos editables, vista previa de
 * totales, envío con idempotencia, confeti y refresco de la página al completar.
 */
export function useCompleteAppointment({
  appt,
  paymentMethodOptions,
  onClose,
  submitIntent,
  onBusyChange,
}: {
  appt: AppointmentForCompletion;
  paymentMethodOptions: PaymentMethodOption[];
  onClose: () => void;
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
  const preview = useMemo(
    () =>
      previewCompletionTotals(
        appt.items.map((item) => ({
          ...item,
          price: toAmount(itemPrices[item.id] ?? item.price ?? 0),
          discountPercentage: parseFloat(itemDiscounts[item.id] || "0") || 0,
          isVariable: item.service?.category?.pricing_mode === "variable",
        }))
      ),
    [appt.items, itemDiscounts, itemPrices]
  );

  function handleComplete() {
    if (pending || completed) return;
    setError(null);
    const itemCharges = JSON.stringify(
      preview.items.map((item) => ({
        id: item.id,
        price: item.price,
        discountPercentage: item.discountPercentage,
      }))
    );

    start(async () => {
      const result = await submitIntent(
        {
          appointment_id: appt.id,
          payment_method: payment,
          completion_price_note: completionPriceNote,
          item_charges: itemCharges,
        },
        (idempotencyKey) => {
          const formData = new FormData();
          formData.set("idempotency_key", idempotencyKey);
          formData.set("appointment_id", appt.id);
          formData.set("payment_method", payment);
          formData.set("completion_price_note", completionPriceNote);
          formData.set("item_charges", itemCharges);
          return completeAppointmentAction(null, formData);
        }
      );
      // El resultado del cobro lo confirma el servidor: su total final sustituye a la vista previa.
      if (result.ok) {
        setCompletedTotal(result.value.total_price);
        setCompleted(true);
        await launchCompletionConfetti(completeButtonRef.current);
        router.refresh();
        window.setTimeout(onClose, 700);
      } else {
        setError(result.error ?? "Error al completar la cita.");
      }
    });
  }

  return {
    payment,
    setPayment,
    itemPrices,
    setItemPrices,
    itemDiscounts,
    setItemDiscounts,
    completionPriceNote,
    setCompletionPriceNote,
    pending,
    completed,
    completedTotal,
    error,
    completeButtonRef,
    preview,
    handleComplete,
  };
}
