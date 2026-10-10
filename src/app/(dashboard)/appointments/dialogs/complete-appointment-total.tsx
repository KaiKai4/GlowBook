import { formatCurrency } from "@/infra/format/dates";

/**
 * Banner del total en el diálogo de completar.
 * Antes de confirmar es solo una VISTA PREVIA del cobro: el cálculo local no es el
 * resultado final. El total definitivo lo calcula y guarda el servidor (`complete_appointment`)
 * y, tras completar, el diálogo muestra ese importe (`finalTotal` llega ya con el valor del servidor).
 */
export function CompleteAppointmentTotal({
  subtotal,
  discountAmount,
  finalTotal,
  completed,
}: {
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
  completed: boolean;
}) {
  if (completed) {
    return (
      <div className="rounded-2xl border border-success-border bg-success-subtle px-5 py-5 text-center">
        <p className="text-sm font-semibold text-success-strong">Cobro registrado</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-success-strong">
          {formatCurrency(finalTotal)}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-success-border bg-success-subtle px-5 py-5 text-center">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-success-fg">
        Vista previa del cobro
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
  );
}
