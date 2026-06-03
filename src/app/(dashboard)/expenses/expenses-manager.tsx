"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ExpensesPageView } from "@/features/expenses/use-cases/expenses";
import type { InventoryProductView } from "@/features/inventory/use-cases/inventory-products";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/dates";
import { createExpenseAction, createInventoryPurchaseExpenseAction } from "./actions";

type ExpensesTab = "history" | "new" | "inventory_purchase";
type ExpenseTypeFilter = "all" | "manual" | "inventory_purchase";

const TABS: Array<{ value: ExpensesTab; label: string }> = [
  { value: "history", label: "Historial" },
  { value: "new", label: "Nuevo gasto" },
  { value: "inventory_purchase", label: "Compra de inventario" },
];

const CONCEPT_SUGGESTIONS = [
  "Alquiler",
  "Luz",
  "Agua",
  "Internet",
  "Suministros",
  "Herramientas",
  "Equipo",
  "Marketing",
  "Impuestos",
  "Nomina/comisiones",
];

export function ExpensesManager({
  expenses,
  inventoryProducts,
  canManageInventory,
}: {
  expenses: ExpensesPageView;
  inventoryProducts: InventoryProductView[];
  canManageInventory: boolean;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [activeTab, setActiveTab] = useState<ExpensesTab>("history");
  const [query, setQuery] = useState("");
  const [conceptFilter, setConceptFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<ExpenseTypeFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState("");
  const [purchaseUnitCost, setPurchaseUnitCost] = useState("");
  const [pendingForm, setPendingForm] = useState<ExpensesTab | null>(null);
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = expenses.history.reduce((sum, item) => sum + item.amount, 0);
  const purchasePreview = Number(purchaseQuantity || 0) * Number(purchaseUnitCost || 0);
  const filteredExpenses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedConcept = conceptFilter.trim().toLowerCase();

    return expenses.history.filter((item) => {
      const haystack = [
        item.concept,
        item.detail,
        item.commerceName ?? "",
        item.note ?? "",
        item.amount,
        expenseTypeLabel(item.type),
      ].join(" ").toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesConcept = !normalizedConcept || item.concept.toLowerCase().includes(normalizedConcept);
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesFrom = !fromDate || item.date >= fromDate;
      const matchesTo = !toDate || item.date <= toDate;
      return matchesQuery && matchesConcept && matchesType && matchesFrom && matchesTo;
    });
  }, [conceptFilter, expenses.history, fromDate, query, toDate, typeFilter]);
  const filteredTotal = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => {
      setMessage(null);
      setError(null);
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, error]);

  function changeTab(tab: ExpensesTab) {
    setActiveTab(tab);
    setMessage(null);
    setError(null);
  }

  function run(kind: ExpensesTab, action: () => Promise<{ ok: boolean; error?: string; value?: string }>) {
    setPendingForm(kind);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMessage(result.value ?? "Registro guardado.");
        setActiveTab("history");
      } else {
        setError(result.error ?? "No se pudo guardar.");
      }
      setPendingForm(null);
    });
  }

  function handleCreateExpense(formData: FormData) {
    run("new", () => createExpenseAction(null, formData));
  }

  function handleCreateInventoryPurchase(formData: FormData) {
    run("inventory_purchase", () => createInventoryPurchaseExpenseAction(null, formData));
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
        <Metric label="Egresos este mes" value={formatCurrency(expenses.monthTotal)} />
        <Metric label="Registros" value={expenses.history.length} />
        <Metric label="Total listado" value={formatCurrency(total)} />
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

      {activeTab === "new" && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo gasto general</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleCreateExpense} className="grid gap-4 lg:grid-cols-2">
              <Input name="expense_date" type="date" label="Fecha" defaultValue={today} required />
              <Input name="amount" type="number" step="0.01" min="0.01" label="Monto" required />
              <div>
                <Input
                  name="concept"
                  label="Concepto del gasto"
                  placeholder="Luz, computadora, impuestos..."
                  list="expense-concepts"
                  required
                />
                <datalist id="expense-concepts">
                  {CONCEPT_SUGGESTIONS.map((concept) => (
                    <option key={concept} value={concept} />
                  ))}
                </datalist>
              </div>
              <Input name="vendor_name" label="Comercio / empresa" placeholder="Naturgy, Panafoto, arrendador..." />
              <div className="lg:col-span-2">
                <Textarea name="note" label="Nota" />
              </div>
              <div className="lg:col-span-2">
                <Button loading={pendingForm === "new"} variant="primary" type="submit">
                  Registrar gasto
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "inventory_purchase" && (
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
                    loading={pendingForm === "inventory_purchase"}
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
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr_0.8fr_0.7fr_0.7fr]">
              <Input
                label="Buscar"
                placeholder="Comercio, nota, producto..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Input
                label="Concepto"
                placeholder="Luz, inventario, equipo..."
                value={conceptFilter}
                onChange={(event) => setConceptFilter(event.target.value)}
              />
              <Select
                label="Tipo de egreso"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as ExpenseTypeFilter)}
              >
                <option value="all">Todos</option>
                <option value="manual">Gasto general</option>
                <option value="inventory_purchase">Compra de inventario</option>
              </Select>
              <Input label="Desde" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              <Input label="Hasta" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Historial de egresos</CardTitle>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase text-stone-400">Total filtrado</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(filteredTotal)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border border-stone-100">
                <div className="grid grid-cols-[1fr_120px_120px] gap-3 bg-stone-50 px-4 py-3 text-xs font-bold uppercase text-stone-400 md:grid-cols-[130px_170px_1fr_180px_140px]">
                  <span>Fecha</span>
                  <span>Tipo</span>
                  <span>Detalle</span>
                  <span className="hidden md:block">Comercio / empresa</span>
                  <span className="text-right">Monto</span>
                </div>
                {filteredExpenses.map((item) => (
                  <div
                    key={`${item.type}:${item.id}`}
                    className="grid grid-cols-[1fr_120px_120px] gap-3 border-t border-stone-100 px-4 py-3 text-sm md:grid-cols-[130px_170px_1fr_180px_140px]"
                  >
                    <span className="text-stone-500">
                      {new Date(`${item.date}T12:00:00`).toLocaleDateString("es-PA")}
                    </span>
                    <span>
                      <span
                        className={
                          item.type === "inventory_purchase"
                            ? "rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700"
                            : "rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600"
                        }
                      >
                        {expenseTypeLabel(item.type)}
                      </span>
                    </span>
                    <div>
                      <p className="font-semibold text-stone-900">{item.concept}</p>
                      <p className="text-xs text-stone-400">{item.detail}</p>
                    </div>
                    <span className="hidden truncate text-stone-500 md:block">
                      {item.commerceName || "Sin registrar"}
                    </span>
                    <span className="text-right font-bold text-red-600">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
                {filteredExpenses.length === 0 && (
                  <p className="border-t border-stone-100 px-4 py-8 text-center text-sm text-stone-400">
                    No hay egresos con esos filtros.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ProductSelect({ products }: { products: InventoryProductView[] }) {
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

function expenseTypeLabel(type: "manual" | "inventory_purchase") {
  return type === "inventory_purchase" ? "Compra de inventario" : "Gasto general";
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
    </div>
  );
}
