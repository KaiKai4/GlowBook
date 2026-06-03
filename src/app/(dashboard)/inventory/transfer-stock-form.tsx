"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  INVENTORY_LOCATION_LABELS,
  type InventoryLocation,
} from "@/features/inventory/domain/stock";
import type { InventoryProductView } from "@/features/inventory/use-cases/inventory-products";

type TransferStockFormProps = {
  products: InventoryProductView[];
  pending: boolean;
  onTransfer: (formData: FormData) => void;
};

export function TransferStockForm({ products, pending, onTransfer }: TransferStockFormProps) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [destination, setDestination] = useState<InventoryLocation>(
    products[0]?.isRetailEnabled ? "retail" : "internal"
  );

  const selectedProduct = products.find((product) => product.id === productId);
  const destinations: InventoryLocation[] = selectedProduct?.isRetailEnabled ? ["retail", "internal"] : ["internal"];

  function changeProduct(nextProductId: string) {
    const product = products.find((item) => item.id === nextProductId);
    setProductId(nextProductId);
    setDestination(product?.isRetailEnabled ? "retail" : "internal");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transferir stock</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={onTransfer} className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <ProductSelect products={products} value={productId} onChange={changeProduct} />
          </div>
          <input type="hidden" name="from_location" value="storage" />
          <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-stone-400">Desde</p>
            <p className="mt-1 text-sm font-semibold text-stone-900">Bodega</p>
          </div>
          {destinations.length === 1 ? (
            <>
              <input type="hidden" name="to_location" value={destinations[0]} />
              <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-stone-400">Hacia</p>
                <p className="mt-1 text-sm font-semibold text-stone-900">
                  {INVENTORY_LOCATION_LABELS[destinations[0]]}
                </p>
              </div>
            </>
          ) : (
            <Select
              name="to_location"
              label="Hacia"
              value={destination}
              onChange={(event) => setDestination(event.target.value as InventoryLocation)}
            >
              {destinations.map((location) => (
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
            <Button loading={pending} variant="primary" type="submit">
              Transferir
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProductSelect({
  products,
  value,
  onChange,
}: {
  products: InventoryProductView[];
  value: string;
  onChange: (productId: string) => void;
}) {
  return (
    <Select name="product_id" label="Producto" value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="">Selecciona producto...</option>
      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.name}
        </option>
      ))}
    </Select>
  );
}
