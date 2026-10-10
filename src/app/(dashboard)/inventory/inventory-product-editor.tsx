"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { INVENTORY_LOCATION_LABELS } from "@/features/inventory/domain/stock";
import type { InventoryProductView } from "@/features/inventory";

type InventoryProductEditorProps = {
  product: InventoryProductView;
  pending: boolean;
  pendingDelete: boolean;
  onSave: (formData: FormData) => void;
  onDelete: () => void;
  onClose: () => void;
};

export function InventoryProductEditor({
  product,
  pending,
  pendingDelete,
  onSave,
  onDelete,
  onClose,
}: InventoryProductEditorProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Dialog
      open
      onClose={onClose}
      title={product.name}
      className="max-w-2xl"
      dismissible={!pending && !pendingDelete}
    >
      <form action={onSave} className="grid gap-3 md:grid-cols-2">
        <Input name="name" label="Nombre" defaultValue={product.name} required />
        <Input name="category" label="Categoría" defaultValue={product.category ?? ""} />
        <Input name="cost_price" type="number" step="0.01" min="0" label="Costo" defaultValue={product.costPrice} />
        <Input
          name="sale_price"
          type="number"
          step="0.01"
          min="0"
          label="Precio venta"
          defaultValue={product.salePrice}
        />
        <Select name="is_retail_enabled" label="Se vende en vitrina" defaultValue={String(product.isRetailEnabled)}>
          <option value="true">Si, aparece en Vitrina</option>
          <option value="false">No, solo inventario/trabajo</option>
        </Select>
        <Select name="is_active" label="Estado" defaultValue={String(product.isActive)}>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </Select>
        {product.stock.map((stock) => (
          <Input
            key={stock.location}
            name={`${stock.location}_minimum`}
            type="number"
            step="0.01"
            min="0"
            label={`Mínimo ${INVENTORY_LOCATION_LABELS[stock.location]}`}
            defaultValue={stock.minimumQuantity}
          />
        ))}
        <div className="md:col-span-2">
          <Button loading={pending} variant="primary" type="submit">
            Guardar producto
          </Button>
        </div>
      </form>
      <div className="mt-4 border-t border-border-subtle pt-4">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm text-fg-subtle">
              Se ocultara de Inventario y Vitrina, conservando el historial.
            </p>
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={pendingDelete}
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
            >
              Confirmar eliminar
            </Button>
          </div>
        ) : (
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
            Eliminar producto
          </Button>
        )}
      </div>
    </Dialog>
  );
}
