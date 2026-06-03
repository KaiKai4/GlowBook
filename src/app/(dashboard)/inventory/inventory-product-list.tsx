"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  INVENTORY_LOCATION_LABELS,
  stockStatus,
} from "@/features/inventory/domain/stock";
import type { InventoryProductView } from "@/features/inventory/use-cases/inventory-products";
import { formatCurrency } from "@/lib/utils/dates";

type ProductFormKind = `edit:${string}` | `delete:${string}`;

type InventoryProductListProps = {
  products: InventoryProductView[];
  pendingForm: ProductFormKind | string | null;
  onSave: (productId: string, formData: FormData) => void;
  onDelete: (productId: string) => void;
};

export function InventoryProductList({ products, pendingForm, onSave, onDelete }: InventoryProductListProps) {
  const [openProductEditorId, setOpenProductEditorId] = useState<string | null>(null);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-stone-900">Productos</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            pending={pendingForm === `edit:${product.id}`}
            isEditing={openProductEditorId === product.id}
            onEditingChange={(open) => setOpenProductEditorId(open ? product.id : null)}
            onSave={(formData) => onSave(product.id, formData)}
            pendingDelete={pendingForm === `delete:${product.id}`}
            onDelete={() => onDelete(product.id)}
          />
        ))}
        {products.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
            Aun no hay productos registrados.
          </p>
        )}
      </div>
    </section>
  );
}

function ProductCard({
  product,
  pending,
  isEditing,
  onEditingChange,
  pendingDelete,
  onSave,
  onDelete,
}: {
  product: InventoryProductView;
  pending: boolean;
  isEditing: boolean;
  onEditingChange: (open: boolean) => void;
  pendingDelete: boolean;
  onSave: (formData: FormData) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-stone-900">{product.name}</h3>
            <p className="text-sm text-stone-400">{product.category || "Sin categoria"}</p>
          </div>
          <span
            className={
              product.isActive
                ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                : "rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-500"
            }
          >
            {product.isActive ? "Activo" : "Inactivo"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={
              product.isRetailEnabled
                ? "rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700"
                : "rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-500"
            }
          >
            {product.isRetailEnabled ? "Se vende en vitrina" : "Solo inventario/trabajo"}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {product.stock
            .filter((stock) => product.isRetailEnabled || stock.location !== "retail")
            .map((stock) => {
              const status = stockStatus(stock.quantity, stock.minimumQuantity);
              return (
                <div key={stock.location} className="rounded-lg border border-stone-100 p-3">
                  <p className="text-xs font-semibold text-stone-400">
                    {INVENTORY_LOCATION_LABELS[stock.location]}
                  </p>
                  <p
                    className={
                      status === "empty"
                        ? "text-xl font-bold text-red-600"
                        : status === "low"
                          ? "text-xl font-bold text-amber-600"
                          : "text-xl font-bold text-stone-900"
                    }
                  >
                    {stock.quantity}
                  </p>
                  <p className="text-xs text-stone-400">Min. {stock.minimumQuantity}</p>
                </div>
              );
            })}
        </div>
        <div className="text-sm text-stone-500">
          Costo {formatCurrency(product.costPrice)}
          {product.isRetailEnabled ? ` - Venta ${formatCurrency(product.salePrice)}` : ""}
        </div>
        <details
          className="rounded-lg border border-stone-100 p-3"
          open={isEditing}
          onToggle={(event) => {
            const nextOpen = event.currentTarget.open;
            onEditingChange(nextOpen);
            if (!nextOpen) setConfirmDelete(false);
          }}
        >
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">Editar producto</summary>
          <form action={onSave} className="mt-4 grid gap-3 md:grid-cols-2">
            <Input name="name" label="Nombre" defaultValue={product.name} required />
            <Input name="category" label="Categoria" defaultValue={product.category ?? ""} />
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
                label={`Minimo ${INVENTORY_LOCATION_LABELS[stock.location]}`}
                defaultValue={stock.minimumQuantity}
              />
            ))}
            <div className="md:col-span-2">
              <Button loading={pending} variant="primary" type="submit">
                Guardar producto
              </Button>
            </div>
          </form>
          <div className="mt-4 border-t border-stone-100 pt-4">
            {confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto text-sm text-stone-500">
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
        </details>
      </CardContent>
    </Card>
  );
}
