"use client";

import { useActionState } from "react";
import { CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CommercialPlan } from "@/features/billing/use-cases/commercial-plans";
import type { SalonSubscriptionDetail } from "@/features/billing/use-cases/salon-subscription-detail";
import { PLATFORM_PLAN_IDLE_STATE } from "../plans/action-state";
import { InlineState, Panel, SubmitButton } from "../plans/workspace-ui";
import { assignPlanAction } from "./actions";
import { formatDate } from "./subscription-format";
import { useAssignPlanState } from "./use-assign-plan-state";

export function AssignPlanForm({ detail, plans }: { detail: SalonSubscriptionDetail; plans: CommercialPlan[] }) {
  const [state, action] = useActionState(assignPlanAction, PLATFORM_PLAN_IDLE_STATE);
  const form = useAssignPlanState(detail.assignment, plans);

  return (
    <Panel
      icon={<CalendarClock className="h-4 w-4" />}
      title={detail.assignment ? "Cambiar plan o estado" : "Asignar plan"}
      description="Las fechas se calculan solas: el plan es mensual y se renueva, y el trial sale de los días de prueba del plan."
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="salonId" value={detail.salonId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select name="planId" label="Plan" value={form.planId} onChange={(e) => form.setPlanId(e.target.value)} required>
            <option value="">Selecciona un plan</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {plan.currency} {plan.monthlyPrice.toFixed(2)}/mes
                {plan.trialDays > 0 ? ` · ${plan.trialDays}d trial` : ""}
              </option>
            ))}
          </Select>
          <Select name="status" label="Estado" value={form.status} onChange={(e) => form.setStatus(e.target.value)}>
            <option value="trialing">En trial</option>
            <option value="active">Activo</option>
            <option value="past_due">Moroso</option>
            <option value="paused">Pausado</option>
            <option value="canceled">Cancelado</option>
          </Select>
        </div>

        <ScheduleSummary
          startsAt={form.startsAt}
          trialEndsAt={form.trialEndsAt}
          status={form.status}
          plan={form.selectedPlan}
          hasExistingStart={form.hasExistingStart}
        />

        <Textarea name="notes" label="Notas internas" rows={2} defaultValue={detail.assignment?.notes ?? ""} />

        <div>
          {form.showEnds ? (
            <Input
              name="endsAt"
              label="Fin programado (suspension)"
              type="date"
              defaultValue={detail.assignment?.endsAt ?? ""}
            />
          ) : (
            <button
              type="button"
              onClick={form.showEndsField}
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
        hint={hasExistingStart ? "Fecha original de la suscripción" : "Comienza hoy"}
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
      <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className="mt-1 text-base font-semibold text-fg-strong">{value}</p>
      <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>
    </div>
  );
}
