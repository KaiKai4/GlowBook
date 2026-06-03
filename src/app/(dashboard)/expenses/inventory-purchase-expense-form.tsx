"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryProductOption } from "@/features/inventory/use-cases/inventory-product-options";
import { formatCurrency } from "@/lib/utils/dates";
import { createInventoryPurchaseExpenseAction } from "./actions";

export function InventoryPurchaseExpenseForm({
  inventoryProducts,
  canManageInventory,
  onResult,
}: {
  inventoryProducts: InventoryProductOption[];
  canManageInventory: boolean;
  onResult: (result: { ok: boolean; message: string }) => void;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [purchaseQuantity, setPurchaseQuantity] = useState("");
  const [purchaseUnitCost, setPurchaseUnitCost] = useState("");
  const [pending, startTransition] = useTransition();
  const purchasePreview = Number(purchaseQuantity || 0) * Number(purchaseUnitCost || 0);

  function handleCreateInventoryPurchase(formData: FormData) {
    startTransition(async () => {
      const result = await createInventoryPurchaseExpenseAction(null, formData);
      onResult({
        ok: result.ok,
        message: result.ok ? result.value : result.error,
      });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compra de inventario</CardTitle>
      </CardHeader>
      <CardContent>
        {!canManageInventory ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Necesitas permiso de inventario para registrar compras de productos.
          </p>
        ) : (
          <form action={handleCreateInventoryPurchase} className="grid gap-4 lg:grid-cols-2">
            <Input name="purchase_date" type="date" label="Fecha" defaultValue={today} required />
            <Input name="supplier_name" label="Comercio / empresa" placeholder="Proveedor, tienda o distribuidor" />
            <div className="lg:col-span-2">
              <ProductSelect products={inventoryProducts} />
            </div>
            <Input
              name="quantity"
              type="number"
              step="1"
              min="1"
              label="Cantidad"
              placeholder="0"
              value={purchaseQuantity}
              onChange={(event) => setPurchaseQuantity(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              required
            />
            <Input
              name="unit_cost"
              type="number"
              step="0.01"
              min="0"
              label="Costo unitario"
              value={purchaseUnitCost}
              onChange={(event) => setPurchaseUnitCost(event.target.value)}
              required
            />
            <div className="lg:col-span-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-brand-500">Destino automatico</p>
              <p className="text-sm font-semibold text-stone-900">Bodega</p>
              <p className="mt-1 text-sm text-stone-500">
                Total de la compra: <span className="font-bold">{formatCurrency(purchasePreview)}</span>
              </p>
            </div>
            <div className="lg:col-span-2">
              <Textarea name="note" label="Nota" />
            </div>
            <div className="lg:col-span-2">
              <Button
                loading={pending}
                variant="primary"
                type="submit"
                disabled={inventoryProducts.length === 0}
              >
                Registrar compra
              </Button>
            </div>
            {inventoryProducts.length === 0 && (
              <p className="lg:col-span-2 text-sm text-stone-400">
                Crea un producto en Inventario antes de registrar una compra.
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ProductSelect({ products }: { products: InventoryProductOption[] }) {
  return (
    <Select name="product_id" label="Producto" required>
      <option value="">Selecciona producto...</option>
      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.name}
        </option>
      ))}
    </Select>
  );
}
