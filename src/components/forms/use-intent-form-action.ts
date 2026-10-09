"use client";

import { useActionState } from "react";
import { formDataEntries, withIdempotencyKey } from "./form-data-intent";
import {
  useSubmissionIntent,
  type SubmissionOutcome,
} from "./use-submission-intent";

/**
 * useActionState para formularios de estado (prev, formData) que envían con intención
 * idempotente: la clave viaja en FormData como "idempotency_key" y se reutiliza en reintentos.
 */
export function useIntentFormAction<S extends SubmissionOutcome>(
  procedure: string,
  action: (prev: Awaited<S>, formData: FormData) => Promise<S>,
  initialState: Awaited<S>,
  onWarnings?: () => void
) {
  const { submit } = useSubmissionIntent({ procedure, onWarnings });

  return useActionState<S, FormData>(
    (prev, formData) =>
      submit(formDataEntries(formData), (idempotencyKey) =>
        action(prev, withIdempotencyKey(formData, idempotencyKey))
      ),
    initialState
  );
}
