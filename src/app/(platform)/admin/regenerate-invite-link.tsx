"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { regenerateSalonInvitationAction } from "./actions";
import { InviteLinkReveal } from "./invite-link-reveal";

// El enlace de una invitacion pendiente no puede volver a mostrarse (la DB
// solo guarda el hash): regenerar emite un token nuevo e inválida el anterior.
export function RegenerateInviteLink({ invitationId }: { invitationId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRegenerate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateSalonInvitationAction(invitationId);
      if (result.ok) setToken(result.value);
      else setError(result.error);
    });
  }

  if (token) {
    return <InviteLinkReveal token={token} />;
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRegenerate}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-accent transition-colors hover:bg-accent-subtle disabled:opacity-50"
        title="Genera un enlace nuevo e inválida el anterior"
      >
        <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />
        Regenerar enlace
      </button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
