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
      title="Archivar categoría"
      description="La categoría dejara de estar disponible para nuevas citas."
      className="max-w-lg"
    >
      <div className="space-y-5">
        <div className="flex gap-3 rounded-xl border border-warning-border bg-warning-subtle p-4 text-warning-strong">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-warning-fg shadow-sm">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold">
              {category
                ? `Vas a archivar "${category.name}".`
                : "Vas a archivar esta categoría."}
            </p>
            <p className="mt-1 text-sm leading-6 text-warning-strong">
              {serviceCount > 0
                ? `Sus ${serviceCount} servicios no apareceran al crear nuevas citas. Las citas, cobros y reportes historicos se conservaran.`
                : "No tiene servicios asociados. El historial del salón se conservara igual."}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-fg">Después podras crear otra categoría con el mismo nombre.</p>
          <p className="mt-1 text-sm leading-6 text-fg-subtle">
            Será una categoría nueva y no se mezclará con la categoría archivada.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-strong">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" loading={pending} onClick={onConfirm}>
            Archivar categoría
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
