"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

// Muestra el enlace de invitacion recien generado. Es la unica oportunidad de
// copiarlo: la base de datos solo guarda el hash del token.
export function InviteLinkReveal({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/invite/${token}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2 rounded-lg border border-accent-border bg-accent-subtle/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-accent-strong">
        <Link2 className="h-3.5 w-3.5 shrink-0" />
        Enlace generado — copialo ahora, no volvera a mostrarse.
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-1.5 text-xs text-fg-secondary">
          {url}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-surface transition-colors hover:bg-accent-strong"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
