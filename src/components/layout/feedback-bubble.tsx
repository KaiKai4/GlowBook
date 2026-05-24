"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils/cn";
import { MessageCircle, X, Send, Check, Bug, Lightbulb, HelpCircle, MoreHorizontal } from "lucide-react";
import { submitFeedbackAction } from "@/app/(dashboard)/feedback/actions";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
} from "@/features/feedback/schemas";

const CATEGORY_ICON: Record<FeedbackCategory, React.ComponentType<{ className?: string }>> = {
  bug: Bug,
  suggestion: Lightbulb,
  question: HelpCircle,
  other: MoreHorizontal,
};

export function FeedbackBubble() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();

  function reset() {
    setMessage("");
    setCategory("bug");
    setError(null);
    setSent(false);
  }

  function close() {
    setOpen(false);
    // Clear after the panel animates out so it's fresh next time.
    setTimeout(reset, 200);
  }

  function handleSend() {
    setError(null);
    startSubmit(async () => {
      const res = await submitFeedbackAction(category, message);
      if (res.ok) setSent(true);
      else setError(res.error);
    });
  }

  return (
    <>
      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[min(92vw,22rem)] rounded-2xl border border-stone-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between rounded-t-2xl bg-brand-600 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Reportar a soporte</p>
              <p className="text-[11px] text-white/80">Fallas, caídas o sugerencias</p>
            </div>
            <button
              onClick={close}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <Check className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-900">¡Reporte enviado!</p>
                <p className="mt-1 text-xs text-stone-500">
                  Gracias. El equipo de GlowBook lo revisará pronto.
                </p>
              </div>
              <button
                onClick={close}
                className="mt-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Listo
              </button>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-stone-500">Tipo de reporte</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {FEEDBACK_CATEGORIES.map((c) => {
                    const Icon = CATEGORY_ICON[c];
                    const active = category === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                          active
                            ? "border-brand-400 bg-brand-50 text-brand-700"
                            : "border-stone-200 text-stone-600 hover:bg-stone-50"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {FEEDBACK_CATEGORY_LABELS[c]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-stone-500">Descripción</p>
                <textarea
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); setError(null); }}
                  rows={4}
                  maxLength={2000}
                  placeholder="Describe lo que pasó o tu sugerencia..."
                  className="w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}

              <button
                onClick={handleSend}
                disabled={pending || message.trim().length < 5}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
                {pending ? "Enviando..." : "Enviar reporte"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-all hover:scale-105",
          open ? "bg-stone-700 text-white" : "bg-brand-600 text-white hover:bg-brand-700"
        )}
        aria-label="Reportar a soporte"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
