"use client";

import { useState } from "react";
import { Check, Clock, Copy, Link2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface EmployeeInviteLinkCardProps {
  url: string;
  title?: string;
  description?: string;
  expiresAt?: string;
}

export function EmployeeInviteLinkCard({
  url,
  title = "Enlace de acceso",
  description,
  expiresAt,
}: EmployeeInviteLinkCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-brand-700">
        {expiresAt ? <Clock className="h-3.5 w-3.5 shrink-0" /> : <Link2 className="h-3.5 w-3.5 shrink-0" />}
        {title}
        {expiresAt ? (
          <>
            {" "}
            - expira el{" "}
            {new Date(expiresAt).toLocaleDateString("es-PA", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </>
        ) : null}
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="h-8 min-w-0 flex-1 cursor-text select-all rounded-md border border-brand-200 bg-white px-2.5 text-xs text-stone-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          onClick={handleCopy}
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors",
            copied ? "bg-emerald-100 text-emerald-700" : "border border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      {description && <p className="text-xs text-stone-400">{description}</p>}
    </div>
  );
}
