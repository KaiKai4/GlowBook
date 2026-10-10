import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CategoryDialog({
  open,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Nueva categoría">
      <form action={onSubmit} className="space-y-4">
        <Input name="name" label="Nombre" placeholder="Cabello, Unas, Barberia..." required />
        <Textarea name="description" label="Descripción (opcional)" />
        <label className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 px-3 py-3">
          <input
            type="checkbox"
            name="pricing_mode"
            value="variable"
            className="mt-1 h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            <span className="block text-sm font-semibold text-brand-800">
              Precio variable al completar
            </span>
            <span className="mt-0.5 block text-xs text-brand-600">
              Permite revisar el precio de estos servicios cuando se cobra la cita.
            </span>
          </span>
        </label>
        {error && <p className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger-strong">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            Crear categoría
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
