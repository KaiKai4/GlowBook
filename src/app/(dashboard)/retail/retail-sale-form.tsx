"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  INVENTORY_LOCATION_LABELS,
  INVENTORY_LOCATIONS,
  type InventoryLocation,
} from "@/features/inventory/domain/stock";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { formatCurrency } from "@/lib/utils/dates";
import { createRetailSaleAction } from "./actions";

export function RetailSaleForm({
  retail,
  onResult,
}: {
  retail: RetailPageView;
  onResult: (result: { ok: boolean; message: string }) => void;
}) {
  const [selectedProductId, setSelectedProductId] = useState(retail.products[0]?.id ?? "");
  const [location, setLocation] = useState<InventoryLocation>("retail");
  const [unitPrice, setUnitPrice] = useState(retail.products[0]?.salePrice ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();

  const selectedProduct = useMemo(
    () => retail.products.find((product) => product.id === selectedProductId),
    [retail.products, selectedProductId]
  );
  const selectedStock = selectedProduct?.stock.find((stock) => stock.location === location);
  const availableUnits = Math.floor(selectedStock?.quantity ?? 0);
  const saleTotal = Number((quantity * unitPrice).toFixed(2));

  function handleProductChange(productId: string) {
    setSelectedProductId(productId);
    const product = retail.products.find((item) => item.id === productId);
    setUnitPrice(product?.salePrice ?? 0);
  }

  function handleSale(formData: FormData) {
    startTransition(async () => {
      const result = await createRetailSaleAction(null, formData);
      onResult({
        ok: result.ok,
        message: result.ok ? result.value : result.error,
      });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Venta rapida</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSale} className="space-y-4">
          <Select name="customer_id" label="Cliente (opcional)" defaultValue="">
            <option value="">Venta sin cliente</option>
            {retail.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>

          <Select
            name="product_id"
            label="Producto"
            value={selectedProductId}
            onChange={(event) => handleProductChange(event.target.value)}
            required
          >
            <option value="">Selecciona producto...</option>
            {retail.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              name="location"
              label="Origen"
              value={location}
              onChange={(event) => setLocation(event.target.value as InventoryLocation)}
            >
              {INVENTORY_LOCATIONS.map((item) => (
                <option key={item} value={item}>
                  {INVENTORY_LOCATION_LABELS[item]}
                </option>
              ))}
            </Select>
            <Input
              name="quantity"
              type="number"
              step="1"
              min="1"
              inputMode="numeric"
              pattern="[0-9]*"
              label="Cantidad"
              value={quantity}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                const nextQuantity = Math.max(1, Math.trunc(Number(event.target.value || 1)));
                setQuantity(nextQuantity);
              }}
              required
            />
          </div>

          <Input
            name="unit_price"
            type="number"
            step="0.01"
            min="0"
            label="Precio unitario"
            value={unitPrice}
            onChange={(event) => setUnitPrice(Number(event.target.value || 0))}
            required
          />
          <Select name="payment_method" label="Metodo de pago" defaultValue="cash">
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="transfer">Transferencia</option>
            <option value="yappy">Yappy</option>
            <option value="other">Otro</option>
          </Select>
          <Textarea name="note" label="Nota" />

          <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-brand-500">Resumen</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">{formatCurrency(saleTotal)}</p>
            <p className="text-sm text-stone-500">
              Disponible en {INVENTORY_LOCATION_LABELS[location]}: {availableUnits}
            </p>
          </div>

          <Button loading={pending} variant="primary" type="submit" disabled={!selectedProductId}>
            Registrar venta
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
