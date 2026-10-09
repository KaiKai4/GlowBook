"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hashSubmissionData } from "./submission-canonical";
import {
  forgetSubmissionIntent,
  readSubmissionJournal,
  rememberSubmissionIntent,
} from "./submission-journal";

export const SAVED_WITH_WARNINGS_MESSAGE =
  "Se guardó, pero no pudimos actualizar todo. Refresca la página.";

export interface SubmissionOutcome {
  ok: boolean;
  warnings?: string[];
}

interface Intent {
  dataHash: string;
  key: string;
}

export interface UseSubmissionIntentOptions {
  procedure: string;
  // Called when a confirmed operation carries warnings (saved, but a later step failed).
  onWarnings?: () => void;
}

// Key for the current attempt: the same data keeps the same key (retries included),
// changed data gets a new key, and a journaled key for the same data is reused.
function resolveKey(procedure: string, dataHash: string, current: Intent | null): string {
  if (current && current.dataHash === dataHash) return current.key;

  const journaled = readSubmissionJournal().find(
    (entry) => entry.procedure === procedure && entry.dataHash === dataHash
  );
  return journaled?.key ?? crypto.randomUUID();
}

export function useSubmissionIntent({ procedure, onWarnings }: UseSubmissionIntentOptions) {
  const [pending, setPending] = useState(false);
  const intentRef = useRef<Intent | null>(null);
  const inFlightRef = useRef<Promise<unknown> | null>(null);
  const onWarningsRef = useRef(onWarnings);

  useEffect(() => {
    onWarningsRef.current = onWarnings;
  }, [onWarnings]);

  const submit = useCallback(
    <T extends SubmissionOutcome>(data: unknown, send: (idempotencyKey: string) => Promise<T>): Promise<T> => {
      // Double trigger while a request is in flight shares the same promise.
      if (inFlightRef.current) return inFlightRef.current as Promise<T>;

      setPending(true);
      const attempt = (async (): Promise<T> => {
        try {
          const dataHash = await hashSubmissionData(data);
          const key = resolveKey(procedure, dataHash, intentRef.current);
          intentRef.current = { dataHash, key };
          rememberSubmissionIntent({ procedure, key, dataHash, startedAt: Date.now() });

          const result = await send(key);
          if (result.ok) {
            intentRef.current = null;
            forgetSubmissionIntent(procedure);
            if (result.warnings && result.warnings.length > 0) onWarningsRef.current?.();
          }
          return result;
        } finally {
          inFlightRef.current = null;
          setPending(false);
        }
      })();

      inFlightRef.current = attempt;
      return attempt;
    },
    [procedure]
  );

  return { submit, pending };
}
