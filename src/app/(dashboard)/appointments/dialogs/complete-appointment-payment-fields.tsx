"use client";

import { Select } from "@/components/ui/select";
import type {
  PaymentMethod,
  PaymentMethodOption,
} from "@/features/payments/domain/payment-methods";

/** Campos de cobro: método de pago y nota opcional del precio. */
export function CompleteAppointmentPaymentFields({
  payment,
  onPaymentChange,
  paymentMethodOptions,
  note,
  onNoteChange,
}: {
  payment: PaymentMethod;
  onPaymentChange: (payment: PaymentMethod) => void;
  paymentMethodOptions: PaymentMethodOption[];
  note: string;
  onNoteChange: (note: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <Select
        label="Método de pago"
        value={payment}
        onChange={(event) => onPaymentChange(event.target.value)}
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
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Ej. promocion, ajuste manual o servicio adicional..."
          className="w-full resize-none rounded-xl border border-border px-3 py-2 text-sm text-fg-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
    </div>
  );
}
