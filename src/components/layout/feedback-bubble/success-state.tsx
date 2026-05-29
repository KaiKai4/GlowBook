import { Check } from "lucide-react";

export function FeedbackSuccessState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
        <Check className="h-6 w-6 text-emerald-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-stone-900">Reporte enviado</p>
        <p className="mt-1 text-xs text-stone-500">
          Gracias. El equipo de GlowBook lo revisara pronto.
        </p>
      </div>
      <button
        onClick={onClose}
        className="mt-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Listo
      </button>
    </div>
  );
}
