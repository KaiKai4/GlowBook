import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/dates";

export function RetailProductList({ products }: { products: RetailPageView["products"] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-stone-900">Productos disponibles</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        {products.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
            Crea productos en Inventario para vender en vitrina.
          </p>
        )}
      </div>
    </section>
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
