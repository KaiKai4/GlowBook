"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { inviteSalonAction } from "../actions";
import { InviteLinkReveal } from "../invite-link-reveal";

interface InviteSalonFormProps {
  plans: Array<{ id: string; name: string; priceLabel: string; trialDays: number }>;
}

export function InviteSalonForm({ plans }: InviteSalonFormProps) {
  const [state, action, pending] = useActionState(inviteSalonAction, null);

  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-semibold text-stone-700" htmlFor="invite-email">
            Correo del owner
          </label>
          <input
            id="invite-email"
            type="email"
            name="email"
            placeholder="owner@salon.com"
            required
            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <div className="sm:w-72">
          <Select name="planId" label="Plan del salon" defaultValue={plans[0]?.id}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {plan.priceLabel}
                {plan.trialDays > 0 ? ` · ${plan.trialDays}d trial` : ""}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="primary" loading={pending}>
          Invitar
        </Button>
      </form>

      {state && !state.ok ? (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      {state?.ok ? <InviteLinkReveal token={state.value} /> : null}

      <p className="text-xs text-stone-400">
        Al aceptar la invitacion, el salon nace con este plan: trial, modulos y límites quedan activos
        antes del primer inicio de sesion.
      </p>
    </div>
  );
}
