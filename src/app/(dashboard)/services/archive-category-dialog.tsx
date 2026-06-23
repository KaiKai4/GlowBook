import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Category } from "./services-types";

export function ArchiveCategoryDialog({
  category,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  category: Category | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const serviceCount = category?.services.length ?? 0;

  return (
    <Dialog
      open={category !== null}
      onClose={pending ? () => undefined : onClose}
      title="Archivar categoria"
      description="La categoria dejara de estar disponible para nuevas citas."
      className="max-w-lg"
    >
      <div className="space-y-5">
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold">
              {category
                ? `Vas a archivar "${category.name}".`
                : "Vas a archivar esta categoria."}
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              {serviceCount > 0
                ? `Sus ${serviceCount} servicios no apareceran al crear nuevas citas. Las citas, cobros y reportes historicos se conservaran.`
                : "No tiene servicios asociados. El historial del salon se conservara igual."}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm font-semibold text-neutral-900">Despues podras crear otra categoria con el mismo nombre.</p>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            Sera una categoria nueva y no se mezclara con la categoria archivada.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" loading={pending} onClick={onConfirm}>
            Archivar categoria
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
