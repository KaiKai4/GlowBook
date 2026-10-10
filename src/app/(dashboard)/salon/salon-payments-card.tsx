import { Check, CreditCard, Plus, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { paymentMethodLabel } from "@/features/payments/domain/payment-methods";
import type { PaymentMethodsState } from "./use-payment-methods";

// Tarjeta "Métodos de pago": alta y baja de métodos y guardado de la lista.
export function SalonPaymentsCard({ payments }: { payments: PaymentMethodsState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-brand-500" />
          Métodos de pago
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-fg-subtle">
          Escribe cada metodo que acepta tu salón. Por ejemplo: Zinli, efectivo, tarjeta o transferencia.
        </p>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            payments.addPaymentMethod(payments.newPaymentMethod);
          }}
        >
          <input
            value={payments.newPaymentMethod}
            onChange={(event) => payments.changeNewPaymentMethod(event.target.value)}
            placeholder="Escribe un método, ej. Zinli"
            maxLength={64}
            className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-fg-secondary outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-brand-500"
          />
          <Button type="submit" variant="primary">
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {payments.enabledPayments.map((method) => (
            <span
              key={method}
              className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800"
            >
              {paymentMethodLabel(method)}
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  payments.removePaymentMethod(method);
                }}
                className="flex h-5 w-5 items-center justify-center rounded-full text-brand-600 transition-colors hover:bg-brand-100 hover:text-brand-800"
                aria-label={`Quitar ${paymentMethodLabel(method)}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={payments.savePaymentMethods} loading={payments.saving}>
            Guardar métodos
          </Button>
          {payments.saved && (
            <span className="flex items-center gap-1 text-sm text-success-fg">
              <Check className="h-4 w-4" /> Métodos actualizados
            </span>
          )}
        </div>
        {payments.error && (
          <p className="rounded-lg bg-danger-subtle border border-danger-border px-3 py-2 text-sm text-danger-strong">
            {payments.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
