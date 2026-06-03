"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INVENTORY_LOCATION_LABELS, INVENTORY_LOCATIONS, type InventoryLocation } from "@/features/inventory/domain/stock";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/dates";
import { createRetailSaleAction } from "./actions";

type RetailTab = "sales" | "products";

const TABS: Array<{ value: RetailTab; label: string }> = [
  { value: "sales", label: "Ventas" },
  { value: "products", label: "Productos disponibles" },
];

export function RetailManager({ retail }: { retail: RetailPageView }) {
  const [activeTab, setActiveTab] = useState<RetailTab>("sales");
  const [selectedProductId, setSelectedProductId] = useState(retail.products[0]?.id ?? "");
  const [location, setLocation] = useState<InventoryLocation>("retail");
  const [unitPrice, setUnitPrice] = useState(retail.products[0]?.salePrice ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => retail.products.find((product) => product.id === selectedProductId),
    [retail.products, selectedProductId]
  );
  const selectedStock = selectedProduct?.stock.find((stock) => stock.location === location);
  const availableUnits = Math.floor(selectedStock?.quantity ?? 0);
  const saleTotal = Number((quantity * unitPrice).toFixed(2));
  const monthSales = retail.recentSales.reduce((sum, sale) => sum + Number(sale.total_amount ?? 0), 0);

  function handleProductChange(productId: string) {
    setSelectedProductId(productId);
    const product = retail.products.find((item) => item.id === productId);
    setUnitPrice(product?.salePrice ?? 0);
  }

  function handleSale(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await createRetailSaleAction(null, formData);
      if (result.ok) setMessage(result.value);
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      {(message || error) && (
        <div className={error ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" : "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"}>
          {error ?? message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Productos activos" value={retail.products.length} />
        <Metric label="Ventas recientes" value={retail.recentSales.length} />
        <Metric label="Ingreso reciente" value={formatCurrency(monthSales)} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white p-1">
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
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

      {activeTab === "sales" && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
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

          <Card>
            <CardHeader>
              <CardTitle>Ventas recientes</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-stone-100">
              {retail.recentSales.map((sale) => (
                <div key={sale.id} className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_140px_140px]">
                  <div>
                    <p className="font-semibold text-stone-900">{customerName(sale.customer)}</p>
                    <p className="text-xs text-stone-400">{sale.note || "Sin nota"}</p>
                  </div>
                  <span>{paymentLabel(sale.payment_method)}</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(Number(sale.total_amount ?? 0))}</span>
                </div>
              ))}
              {retail.recentSales.length === 0 && (
                <p className="py-8 text-center text-sm text-stone-400">Sin ventas registradas todavia.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "products" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">Productos disponibles</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {retail.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {retail.products.length === 0 && (
              <p className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
                Crea productos en Inventario para vender en vitrina.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: RetailPageView["products"][number] }) {
  const retailStock = product.stock.find((stock) => stock.location === "retail")?.quantity ?? 0;
  const storageStock = product.stock.find((stock) => stock.location === "storage")?.quantity ?? 0;
  const internalStock = product.stock.find((stock) => stock.location === "internal")?.quantity ?? 0;
  const isOut = retailStock <= 0;
  const isLow = !isOut && retailStock <= 2;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-stone-900">{product.name}</p>
          <p className="text-sm text-stone-400">{product.category || "Sin categoria"}</p>
        </div>
        <p className="shrink-0 font-bold text-rose-600">{formatCurrency(product.salePrice)}</p>
      </div>
      <div className="mt-4 rounded-lg bg-brand-50 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-brand-500">Vitrina</p>
          <span
            className={cn(
              "rounded-full px-2 py-1 text-xs font-semibold",
              isOut
                ? "bg-red-100 text-red-700"
                : isLow
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
            )}
          >
            {isOut ? "Agotado" : isLow ? "Bajo" : "Disponible"}
          </span>
        </div>
        <p className="mt-1 text-3xl font-bold text-stone-900">{retailStock}</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <StockPill label="Bodega" value={storageStock} />
        <StockPill label="Uso interno" value={internalStock} />
      </div>
    </div>
  );
}

function StockPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
      <p className="text-xs font-semibold text-stone-400">{label}</p>
      <p className="text-lg font-bold text-stone-900">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
    </div>
  );
}

function customerName(customer: RetailPageView["recentSales"][number]["customer"]) {
  const value = Array.isArray(customer) ? customer[0] : customer;
  if (!value) return "Venta sin cliente";
  return `${value.first_name} ${value.last_name}`.trim();
}

function paymentLabel(value: string) {
  const labels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    yappy: "Yappy",
    other: "Otro",
  };
  return labels[value] ?? value;
}
