import { Send, X } from "lucide-react";
import { FeedbackCategoryPicker } from "./category-picker";
import { FeedbackSuccessState } from "./success-state";
import type { FeedbackCategory } from "@/features/feedback/schemas";

export function FeedbackPanel({
  category,
  message,
  sent,
  error,
  pending,
  onCategoryChange,
  onMessageChange,
  onClose,
  onSend,
  position,
}: {
  category: FeedbackCategory;
  message: string;
  sent: boolean;
  error: string | null;
  pending: boolean;
  onCategoryChange: (category: FeedbackCategory) => void;
  onMessageChange: (message: string) => void;
  onClose: () => void;
  onSend: () => void;
  position?: { top: number; left: number };
}) {
  return (
    <div
      style={position ?? { bottom: 96, right: 24 }}
      className="fixed z-50 w-[min(92vw,22rem)] rounded-2xl border border-border bg-surface shadow-floating"
    >
      <div className="flex items-center justify-between rounded-t-2xl bg-brand-600 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-surface">Reportar a soporte</p>
          <p className="text-xs text-surface/80">Fallas, caidas o sugerencias</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-surface/80 transition-colors hover:bg-surface/15 hover:text-surface"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {sent ? (
        <FeedbackSuccessState onClose={onClose} />
      ) : (
        <div className="space-y-3 p-4">
          <FeedbackCategoryPicker value={category} onChange={onCategoryChange} />

          <div>
            <p className="mb-1.5 text-xs font-medium text-fg-subtle">Descripcion</p>
            <textarea
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Describe lo que paso o tu sugerencia..."
              className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-secondary placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <button
            onClick={onSend}
            disabled={pending || message.trim().length < 5}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {pending ? "Enviando..." : "Enviar reporte"}
          </button>
        </div>
      )}
    </div>
  );
}
