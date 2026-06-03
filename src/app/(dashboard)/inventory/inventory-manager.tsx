"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  INVENTORY_LOCATION_LABELS,
  stockStatus,
  type InventoryLocation,
} from "@/features/inventory/domain/stock";
import type { InventoryPageView, InventoryProductView } from "@/features/inventory/use-cases/inventory-products";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/dates";
import {
  createInventoryProductAction,
  deleteInventoryProductAction,
  transferInventoryStockAction,
  updateInventoryProductAction,
} from "./actions";

type InventoryTab = "transfer" | "product" | "products" | "movements";
type FormKind = "product" | "transfer" | `edit:${string}` | `delete:${string}`;

const TABS: Array<{ value: InventoryTab; label: string }> = [
  { value: "products", label: "Productos" },
  { value: "transfer", label: "Transferir stock" },
  { value: "product", label: "Nuevo producto" },
  { value: "movements", label: "Movimientos" },
];

export function InventoryManager({ inventory }: { inventory: InventoryPageView }) {
  const [activeTab, setActiveTab] = useState<InventoryTab>("products");
  const [newProductRetailEnabled, setNewProductRetailEnabled] = useState(true);
  const [transferProductId, setTransferProductId] = useState(inventory.products[0]?.id ?? "");
  const [transferDestination, setTransferDestination] = useState<InventoryLocation>(
    inventory.products[0]?.isRetailEnabled ? "retail" : "internal"
  );
  const [pendingForm, setPendingForm] = useState<FormKind | null>(null);
  const [completedForm, setCompletedForm] = useState<FormKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(kind: FormKind, action: () => Promise<{ ok: boolean; error?: string; value?: unknown }>) {
    setPendingForm(kind);
    setCompletedForm(null);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setCompletedForm(kind);
        setMessage(typeof result.value === "string" ? result.value : "Cambios guardados.");
      } else {
        setError(result.error ?? "No se pudo guardar.");
      }
      setPendingForm(null);
    });
  }

  function handleCreateProduct(formData: FormData) {
    run("product", () => createInventoryProductAction(null, formData));
  }

  function handleTransfer(formData: FormData) {
    run("transfer", () => transferInventoryStockAction(null, formData));
  }

  const totalProducts = inventory.products.length;
  const lowProducts = inventory.lowStock.length;
  const selectedTransferProduct = inventory.products.find((product) => product.id === transferProductId);
  const transferDestinations: InventoryLocation[] = selectedTransferProduct?.isRetailEnabled
    ? ["retail", "internal"]
    : ["internal"];

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => {
      setMessage(null);
      setError(null);
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, error]);

  function changeTab(tab: InventoryTab) {
    setActiveTab(tab);
    setMessage(null);
    setError(null);
  }

  function changeTransferProduct(productId: string) {
    const product = inventory.products.find((item) => item.id === productId);
    setTransferProductId(productId);
    setTransferDestination(product?.isRetailEnabled ? "retail" : "internal");
  }

  return (
    <div className="space-y-6">
      {(message || error) && (
        <div
          className={
            error
              ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              : "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          }
        >
          {error ?? message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Productos" value={totalProducts} />
        <Metric label="Bajos o agotados" value={lowProducts} tone={lowProducts > 0 ? "warn" : "ok"} />
        <Metric label="Movimientos recientes" value={inventory.recentMovements.length} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white p-1">
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => changeTab(tab.value)}
              className={cn(
                "h-10 rounded-lg px-4 text-sm font-semibold transition-colors",
                activeTab === tab.value
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "transfer" && (
        <Card>
          <CardHeader>
            <CardTitle>Transferir stock</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleTransfer} className="grid gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <ProductSelect
                  products={inventory.products}
                  value={transferProductId}
                  onChange={(event) => changeTransferProduct(event.target.value)}
                />
              </div>
              <input type="hidden" name="from_location" value="storage" />
              <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-stone-400">Desde</p>
                <p className="mt-1 text-sm font-semibold text-stone-900">Bodega</p>
              </div>
              {transferDestinations.length === 1 ? (
                <>
                  <input type="hidden" name="to_location" value={transferDestinations[0]} />
                  <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase text-stone-400">Hacia</p>
                    <p className="mt-1 text-sm font-semibold text-stone-900">
                      {INVENTORY_LOCATION_LABELS[transferDestinations[0]]}
                    </p>
                  </div>
                </>
              ) : (
                <Select
                  name="to_location"
                  label="Hacia"
                  value={transferDestination}
                  onChange={(event) => setTransferDestination(event.target.value as InventoryLocation)}
                >
                  {transferDestinations.map((location) => (
                    <option key={location} value={location}>
                      {INVENTORY_LOCATION_LABELS[location]}
                    </option>
                  ))}
                </Select>
              )}
              <Input
                name="quantity"
                type="number"
                step="0.01"
                min="0.01"
                label="Cantidad"
                placeholder="0"
                onFocus={(event) => event.currentTarget.select()}
                required
              />
              <div className="lg:col-span-2">
                <Textarea name="note" label="Nota" />
              </div>
              <div className="lg:col-span-2">
                <Button loading={pendingForm === "transfer"} variant="primary" type="submit">
                  Transferir
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "product" && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo producto</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleCreateProduct} className="grid gap-4 md:grid-cols-2">
              <Input name="name" label="Producto" placeholder="Shampoo hidratante" required />
              <Input name="category" label="Categoria" placeholder="Cabello" />
              <Input name="cost_price" type="number" step="0.01" min="0" label="Costo" defaultValue="0" />
              <Select
                name="is_retail_enabled"
                label="Se vende en vitrina"
                value={String(newProductRetailEnabled)}
                onChange={(event) => setNewProductRetailEnabled(event.target.value === "true")}
              >
                <option value="true">Si, aparece en Vitrina</option>
                <option value="false">No, solo inventario/trabajo</option>
              </Select>
              <Input
                name="sale_price"
                type="number"
                step="0.01"
                min="0"
                label="Precio venta"
                defaultValue="0"
                disabled={!newProductRetailEnabled}
                hint={!newProductRetailEnabled ? "No aplica para productos que no se venden en vitrina." : undefined}
              />
              <StockInputs prefix="retail" label="Vitrina" disabled={!newProductRetailEnabled} />
              <StockInputs prefix="internal" label="Uso interno" />
              <StockInputs prefix="storage" label="Bodega" />
              <div className="md:col-span-2">
                <Button loading={pendingForm === "product"} variant="primary" type="submit">
                  Crear producto
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "products" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">Productos</h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {inventory.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                pending={pendingForm === `edit:${product.id}`}
                completed={completedForm === `edit:${product.id}`}
                onSave={(formData) =>
                  run(`edit:${product.id}`, () => updateInventoryProductAction(product.id, null, formData))
                }
                pendingDelete={pendingForm === `delete:${product.id}`}
                onDelete={() => run(`delete:${product.id}`, () => deleteInventoryProductAction(product.id))}
              />
            ))}
            {inventory.products.length === 0 && (
              <p className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
                Aun no hay productos registrados.
              </p>
            )}
          </div>
        </section>
      )}

      {activeTab === "movements" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">Movimientos recientes</h2>
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            {inventory.recentMovements.map((movement) => (
              <div
                key={movement.id}
                className="grid gap-2 border-b border-stone-100 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_140px_120px_160px]"
              >
                <div>
                  <p className="font-semibold text-stone-900">{movement.productName}</p>
                  <p className="text-xs text-stone-400">{movement.note || "Sin nota"}</p>
                </div>
                <span>{INVENTORY_LOCATION_LABELS[movement.location]}</span>
                <span className={movement.quantityDelta < 0 ? "text-red-600" : "text-emerald-600"}>
                  {movement.quantityDelta > 0 ? "+" : ""}
                  {movement.quantityDelta}
                </span>
                <span className="text-stone-500">
                  {new Date(movement.createdAt).toLocaleString("es-PA")}
                </span>
              </div>
            ))}
            {inventory.recentMovements.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-stone-400">Sin movimientos todavia.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warn" | "ok" }) {
  const color = tone === "warn" ? "text-amber-700" : tone === "ok" ? "text-emerald-700" : "text-stone-900";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-stone-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function StockInputs({
  prefix,
  label,
  disabled = false,
}: {
  prefix: "retail" | "internal" | "storage";
  label: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="rounded-xl border border-stone-100 p-3">
      <legend className="px-1 text-xs font-bold uppercase text-stone-400">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          name={`${prefix}_quantity`}
          type="number"
          step="0.01"
          min="0"
          label="Cantidad"
          placeholder="0"
          disabled={disabled}
          onFocus={(event) => event.currentTarget.select()}
        />
        <Input
          name={`${prefix}_minimum`}
          type="number"
          step="0.01"
          min="0"
          label="Minimo"
          placeholder="0"
          disabled={disabled}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
    </fieldset>
  );
}

function ProductSelect({
  products,
  value,
  onChange,
}: {
  products: InventoryProductView[];
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <Select name="product_id" label="Producto" value={value} onChange={onChange} required>
      <option value="">Selecciona producto...</option>
      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.name}
        </option>
      ))}
    </Select>
  );
}

function ProductCard({
  product,
  pending,
  completed,
  pendingDelete,
  onSave,
  onDelete,
}: {
  product: InventoryProductView;
  pending: boolean;
  completed: boolean;
  pendingDelete: boolean;
  onSave: (formData: FormData) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!completed) return;
    setIsEditing(false);
    setConfirmDelete(false);
  }, [completed]);

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
                <p className="text-xs font-semibold text-stone-400">{INVENTORY_LOCATION_LABELS[stock.location]}</p>
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
            setIsEditing(nextOpen);
            if (!nextOpen) setConfirmDelete(false);
          }}
        >
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">Editar producto</summary>
          <form action={onSave} className="mt-4 grid gap-3 md:grid-cols-2">
            <Input name="name" label="Nombre" defaultValue={product.name} required />
            <Input name="category" label="Categoria" defaultValue={product.category ?? ""} />
            <Input name="cost_price" type="number" step="0.01" min="0" label="Costo" defaultValue={product.costPrice} />
            <Input name="sale_price" type="number" step="0.01" min="0" label="Precio venta" defaultValue={product.salePrice} />
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
