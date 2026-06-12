"use client";

import { useActionState, useState } from "react";
import { BadgeDollarSign, CalendarClock, CreditCard, Gift, Gauge, History } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CommercialPlan } from "@/features/billing/use-cases/commercial-plans";
import { addDays, todayIso } from "@/features/billing/domain/assignment-schedule";
import type {
  SalonSubscriptionDetail,
  SubscriptionsPageData,
} from "@/features/billing/use-cases/salon-subscriptions";
import { cn } from "@/lib/utils/cn";
import { PLATFORM_PLAN_IDLE_STATE } from "../plans/action-state";
import { InlineState, MiniMetric, Panel, SubmitButton } from "../plans/workspace-ui";
import { assignPlanAction, registerPaymentAction } from "./actions";
import { ExtrasPanel } from "./extras-panel";
import { UsagePanel } from "./usage-panel";

type DetailTab = "plan" | "extras" | "usage";

const DETAIL_TABS: Array<{ key: DetailTab; label: string; icon: React.ReactNode }> = [
  { key: "plan", label: "Plan", icon: <CreditCard className="h-4 w-4" /> },
  { key: "extras", label: "Extras", icon: <Gift className="h-4 w-4" /> },
  { key: "usage", label: "Uso", icon: <Gauge className="h-4 w-4" /> },
];

const STATUS_LABELS: Record<string, string> = {
  trialing: "En trial",
  active: "Activo",
  past_due: "Moroso",
  paused: "Pausado",
  canceled: "Cancelado",
};

export function SubscriptionDetail({
  salonName,
  detail,
  catalog,
}: {
  salonName: string;
  detail: SalonSubscriptionDetail;
  catalog: Pick<SubscriptionsPageData, "plans" | "addons" | "metrics" | "modules">;
}) {
  const [tab, setTab] = useState<DetailTab>("plan");
  const [suggestedMetricKey, setSuggestedMetricKey] = useState<string | null>(null);
  const warningCount = detail.limits.filter((limit) => limit.warningLevel !== "none").length;

  function expandLimit(metricKey: string) {
    setSuggestedMetricKey(metricKey);
    setTab("extras");
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-stone-950">{salonName}</h2>
          <p className="mt-1 text-sm text-stone-500">
            {detail.plan
              ? `${detail.plan.name} · ${STATUS_LABELS[detail.assignment?.status ?? ""] ?? "Sin estado"} · ${detail.plan.currency} ${detail.monthlyTotal.toFixed(2)}/mes`
              : "Este salon todavia no tiene plan asignado."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {DETAIL_TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
                tab === item.key
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-brand-100 bg-white text-stone-600 hover:border-brand-200 hover:text-brand-700"
              )}
            >
              {item.icon}
              {item.label}
              {item.key === "extras" && detail.extras.length > 0 ? (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] text-brand-700">{detail.extras.length}</span>
              ) : null}
              {item.key === "usage" && warningCount > 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">{warningCount}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === "plan" ? <PlanTab detail={detail} plans={catalog.plans} /> : null}
        {tab === "extras" ? (
          <ExtrasPanel
            salonId={detail.salonId}
            extras={detail.extras}
            addons={catalog.addons}
            metrics={catalog.metrics}
            modules={catalog.modules}
            suggestedMetricKey={suggestedMetricKey}
          />
        ) : null}
        {tab === "usage" ? (
          <UsagePanel detail={detail} modules={catalog.modules} onExpandLimit={expandLimit} />
        ) : null}
      </div>
    </section>
  );
}

function PlanTab({ detail, plans }: { detail: SalonSubscriptionDetail; plans: CommercialPlan[] }) {
  const paidUntil = detail.assignment?.currentPeriodEnd;
  const trialEndsAt = detail.assignment?.trialEndsAt;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <MiniMetric label="Plan base" value={detail.plan ? `${detail.plan.currency} ${detail.planPrice.toFixed(2)}` : "—"} />
        <MiniMetric label="Extras" value={`USD ${detail.extrasPrice.toFixed(2)}`} />
        <MiniMetric label="Total mensual" value={`USD ${detail.monthlyTotal.toFixed(2)}`} />
        {paidUntil ? (
          <MiniMetric label="Pagado hasta" value={formatDate(paidUntil)} />
        ) : (
          <MiniMetric label="Trial termina" value={trialEndsAt ? formatDate(trialEndsAt) : "—"} />
        )}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <AssignPlanForm detail={detail} plans={plans} />
        <RegisterPaymentSection detail={detail} />
      </div>
    </div>
  );
}

function RegisterPaymentSection({ detail }: { detail: SalonSubscriptionDetail }) {
  const [state, action] = useActionState(registerPaymentAction, PLATFORM_PLAN_IDLE_STATE);
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
            ? `Periodo vigente: ${period}. Un nuevo pago encadena el siguiente mes.`
            : "Marca que el salon ya pago: activa la suscripcion y arranca su mes de uso."
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
          <p className="text-sm text-stone-500">Asigna un plan antes de registrar pagos.</p>
        )}
      </Panel>

      {detail.payments.length > 0 ? (
        <Panel
          icon={<History className="h-4 w-4" />}
          title="Historial de pagos"
          description="Últimos pagos registrados y el mes que cubrio cada uno."
        >
          <div className="divide-y divide-brand-100">
            {detail.payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900">
                    {payment.currency} {payment.amount.toFixed(2)}
                    <span className="ml-2 text-xs font-normal text-stone-400">
                      pagado el {formatDate(payment.paidAt)}
                    </span>
                  </p>
                  {payment.notes ? <p className="mt-0.5 text-xs text-stone-500">{payment.notes}</p> : null}
                </div>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
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

function AssignPlanForm({ detail, plans }: { detail: SalonSubscriptionDetail; plans: CommercialPlan[] }) {
  const [state, action] = useActionState(assignPlanAction, PLATFORM_PLAN_IDLE_STATE);
  const [planId, setPlanId] = useState(detail.assignment?.planId ?? "");
  const [status, setStatus] = useState<string>(detail.assignment?.status ?? "trialing");
  const [showEnds, setShowEnds] = useState(Boolean(detail.assignment?.endsAt));

  const selectedPlan = plans.find((plan) => plan.id === planId) ?? null;
  const startsAt = detail.assignment?.startsAt ?? todayIso();
  const trialEndsAt =
    status === "trialing" && selectedPlan && selectedPlan.trialDays > 0
      ? addDays(startsAt, selectedPlan.trialDays)
      : null;

  return (
    <Panel
      icon={<CalendarClock className="h-4 w-4" />}
      title={detail.assignment ? "Cambiar plan o estado" : "Asignar plan"}
      description="Las fechas se calculan solas: el plan es mensual y se renueva, y el trial sale de los días de prueba del plan."
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="salonId" value={detail.salonId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select name="planId" label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
            <option value="">Selecciona un plan</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {plan.currency} {plan.monthlyPrice.toFixed(2)}/mes
                {plan.trialDays > 0 ? ` · ${plan.trialDays}d trial` : ""}
              </option>
            ))}
          </Select>
          <Select name="status" label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="trialing">En trial</option>
            <option value="active">Activo</option>
            <option value="past_due">Moroso</option>
            <option value="paused">Pausado</option>
            <option value="canceled">Cancelado</option>
          </Select>
        </div>

        <ScheduleSummary
          startsAt={startsAt}
          trialEndsAt={trialEndsAt}
          status={status}
          plan={selectedPlan}
          hasExistingStart={Boolean(detail.assignment?.startsAt)}
        />

        <Textarea name="notes" label="Notas internas" rows={2} defaultValue={detail.assignment?.notes ?? ""} />

        <div>
          {showEnds ? (
            <Input
              name="endsAt"
              label="Fin programado (suspension)"
              type="date"
              defaultValue={detail.assignment?.endsAt ?? ""}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowEnds(true)}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
            >
              + Programar suspension en una fecha
            </button>
          )}
        </div>

        <div className="sm:max-w-xs">
          <SubmitButton label={detail.assignment ? "Guardar cambios" : "Asignar plan"} />
        </div>
        <InlineState state={state} block />
      </form>
    </Panel>
  );
}

function ScheduleSummary({
  startsAt,
  trialEndsAt,
  status,
  plan,
  hasExistingStart,
}: {
  startsAt: string;
  trialEndsAt: string | null;
  status: string;
  plan: CommercialPlan | null;
  hasExistingStart: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-brand-100 bg-brand-50/30 p-4 sm:grid-cols-2">
      <ScheduleItem
        label={hasExistingStart ? "Inicio (se conserva)" : "Inicio"}
        value={formatDate(startsAt)}
        hint={hasExistingStart ? "Fecha original de la suscripcion" : "Comienza hoy"}
      />
      <ScheduleItem
        label="Fin del trial"
        value={trialEndsAt ? formatDate(trialEndsAt) : "Sin trial"}
        hint={
          status !== "trialing"
            ? "El estado no es trial"
            : !plan
              ? "Selecciona un plan"
              : plan.trialDays > 0
                ? `${plan.trialDays} días de prueba del plan`
                : "Este plan no ofrece prueba"
        }
      />
    </div>
  );
}

function ScheduleItem({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-base font-bold text-stone-950">{value}</p>
      <p className="mt-0.5 text-xs text-stone-500">{hint}</p>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-PA", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
}
