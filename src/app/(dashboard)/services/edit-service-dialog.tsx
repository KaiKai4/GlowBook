import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Category, ServiceItem } from "./services-types";
import { ServiceDurationFields } from "./service-duration-fields";

export function EditServiceDialog({
  service,
  categories,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  service: ServiceItem | null;
  categories: Category[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  if (!service) return null;

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title="Editar servicio"
      description="Actualiza precio, duracion, categoria y estado."
    >
      <form action={onSubmit} className="space-y-4">
        <Select name="category_id" label="Categoria" defaultValue={service.category_id} required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Input name="name" label="Nombre del servicio" defaultValue={service.name} required />
        <ServiceDurationFields defaultValue={service.duration_minutes} />
        <Input
          name="price"
          label="Precio (USD)"
          type="number"
          min={0}
          step="0.01"
          defaultValue={service.price}
          required
        />
        <Select name="is_active" label="Estado" defaultValue={service.is_active ? "true" : "false"} required>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </Select>
        <Textarea
          name="description"
          label="Descripcion (opcional)"
          defaultValue={service.description ?? ""}
        />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
