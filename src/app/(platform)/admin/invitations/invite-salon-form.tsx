"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  SAVED_WITH_WARNINGS_MESSAGE,
  useSubmissionIntent,
} from "@/components/forms/use-submission-intent";
import { formDataEntries, withIdempotencyKey } from "@/components/forms/form-data-intent";
import { inviteSalonAction } from "../actions";
import { InviteLinkReveal } from "../invite-link-reveal";

interface InviteSalonFormProps {
  plans: Array<{ id: string; name: string; priceLabel: string; trialDays: number }>;
}

/** Estado inicial del formulario: todavía no se ha enviado ninguna invitación. */
const NO_INVITE_RESULT: Awaited<ReturnType<typeof inviteSalonAction>> | null = null;

export function InviteSalonForm({ plans }: InviteSalonFormProps) {
  const toast = useToast();
  const { submit } = useSubmissionIntent({
    procedure: "platform.invite-salon",
    onWarnings: () => toast.warning(SAVED_WITH_WARNINGS_MESSAGE),
  });
  const [state, action, pending] = useActionState(
    (_prev: Awaited<ReturnType<typeof inviteSalonAction>> | null, formData: FormData) =>
      submit(formDataEntries(formData), (idempotencyKey) =>
        inviteSalonAction(null, withIdempotencyKey(formData, idempotencyKey))
      ),
    NO_INVITE_RESULT
  );

  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-semibold text-fg-secondary" htmlFor="invite-email">
            Correo del owner
          </label>
          <input
            id="invite-email"
            type="email"
            name="email"
            placeholder="owner@salon.com"
            required
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="sm:w-72">
          <Select name="planId" label="Plan del salón" defaultValue={plans[0]?.id}>
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
        <p className="rounded-lg border border-danger-border-subtle bg-danger-subtle px-3 py-2 text-sm text-danger-strong">
          {state.error}
        </p>
      ) : null}

      {state?.ok ? <InviteLinkReveal token={state.value} /> : null}

      <p className="text-xs text-fg-subtle">
        Al aceptar la invitación, el salón nace con este plan: trial, módulos y límites quedan activos
        antes del primer inicio de sesión.
      </p>
    </div>
  );
}
