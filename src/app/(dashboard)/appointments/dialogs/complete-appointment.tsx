"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  SAVED_WITH_WARNINGS_MESSAGE,
  useSubmissionIntent,
} from "@/components/forms/use-submission-intent";
import { cn } from "@/components/ui/cn";
import type { PaymentMethodOption } from "@/features/payments/domain/payment-methods";
import { CheckCircle2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { ChargedItemsSection } from "./complete-appointment-items";
import { CompleteAppointmentTotal } from "./complete-appointment-total";
import { CompleteAppointmentPaymentFields } from "./complete-appointment-payment-fields";
import {
  type AppointmentForCompletion,
  useCompleteAppointment,
} from "./use-complete-appointment";

export type { AppointmentForCompletion } from "./use-complete-appointment";

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
  const {
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
  } = useCompleteAppointment({
    appt,
    paymentMethodOptions,
    onClose,
    submitIntent,
    onBusyChange,
  });
  const { items: chargedItems, subtotal, discountAmount, finalTotal } = preview;

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

      {error && <Alert variant="danger">{error}</Alert>}

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
