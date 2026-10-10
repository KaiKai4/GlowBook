import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Category } from "./services-types";
import { ServiceDurationFields } from "./service-duration-fields";

export function NewServiceDialog({
  open,
  categories,
  defaultCategory,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  categories: Category[];
  defaultCategory: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Nuevo servicio">
      <form action={onSubmit} className="space-y-4">
        <Select name="category_id" label="Categoría" defaultValue={defaultCategory} required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Input name="name" label="Nombre del servicio" placeholder="Corte de cabello" required />
        <ServiceDurationFields />
        <Input
          name="price"
          label="Precio (USD)"
          type="number"
          min={0}
          step="0.01"
          defaultValue={0}
          required
        />
        <Textarea name="description" label="Descripcion (opcional)" />
        {error && <p className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger-strong">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            Crear servicio
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
