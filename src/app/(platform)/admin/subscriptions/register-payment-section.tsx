import { BadgeDollarSign, History } from "lucide-react";
import { useIntentFormAction } from "@/components/forms/use-intent-form-action";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { SAVED_WITH_WARNINGS_MESSAGE } from "@/components/forms/use-submission-intent";
import type { SalonSubscriptionDetail } from "@/features/billing";
import { todayIso } from "@/features/billing/domain/assignment-schedule";
import { PLATFORM_PLAN_IDLE_STATE } from "../plans/action-state";
import { InlineState, Panel, SubmitButton } from "../plans/workspace-ui";
import { registerPaymentAction } from "./actions";
import { formatDate } from "./subscription-format";

export function RegisterPaymentSection({ detail }: { detail: SalonSubscriptionDetail }) {
  const toast = useToast();
  const [state, action] = useIntentFormAction(
    "platform.register-payment",
    registerPaymentAction,
    PLATFORM_PLAN_IDLE_STATE,
    () => toast.warning(SAVED_WITH_WARNINGS_MESSAGE)
  );
  const period = detail.assignment?.currentPeriodStart && detail.assignment.currentPeriodEnd
    ? `${formatDate(detail.assignment.currentPeriodStart)} — ${formatDate(detail.assignment.currentPeriodEnd)}`
    : null;

  return (
    <div className="space-y-5">
      <Panel
        icon={<BadgeDollarSign className="h-4 w-4" />}
        title="Registrar pago"
        description={
          period
            ? `Período vigente: ${period}. Un nuevo pago encadena el siguiente mes.`
            : "Marca que el salón ya pago: activa la suscripción y arranca su mes de uso."
        }
      >
        {detail.assignment ? (
          <form action={action} className="space-y-3">
            <input type="hidden" name="salonId" value={detail.salonId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                name="amount"
                label="Monto recibido"
                type="number"
                min="0"
                step="0.01"
                defaultValue={detail.monthlyTotal.toFixed(2)}
                required
              />
              <Input name="paidAt" label="Fecha del pago" type="date" defaultValue={todayIso()} />
            </div>
            <Input name="notes" label="Nota (opcional)" placeholder="Yappy, efectivo, transferencia..." />
            <div className="sm:max-w-xs">
              <SubmitButton label="Registrar pago" />
            </div>
            <InlineState state={state} block />
          </form>
        ) : (
          <p className="text-sm text-fg-subtle">Asigna un plan antes de registrar pagos.</p>
        )}
      </Panel>

      {detail.payments.length > 0 ? (
        <Panel
          icon={<History className="h-4 w-4" />}
          title="Historial de pagos"
          description="Últimos pagos registrados y el mes que cubrió cada uno."
        >
          <div className="divide-y divide-brand-100">
            {detail.payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">
                    {payment.currency} {payment.amount.toFixed(2)}
                    <span className="ml-2 text-xs font-normal text-fg-subtle">
                      pagado el {formatDate(payment.paidAt)}
                    </span>
                  </p>
                  {payment.notes ? <p className="mt-0.5 text-xs text-fg-subtle">{payment.notes}</p> : null}
                </div>
                <span className="rounded-lg bg-success-subtle px-2.5 py-1 text-xs font-semibold text-success-strong">
                  {formatDate(payment.periodStart)} — {formatDate(payment.periodEnd)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
