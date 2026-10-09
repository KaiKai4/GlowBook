import { StatusBadge } from "@/components/ui/status-badge";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { formatCurrency } from "@/infra/format/dates";

export function RetailProductList({ products }: { products: RetailPageView["products"] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-fg">Productos disponibles</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        {products.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-fg-subtle">
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
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg">{product.name}</p>
          <p className="text-sm text-fg-subtle">{product.category || "Sin categoria"}</p>
        </div>
        <p className="shrink-0 font-semibold text-accent">{formatCurrency(product.salePrice)}</p>
      </div>
      <div className="mt-4 rounded-lg bg-brand-50 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-brand-600">Vitrina</p>
          {isOut ? (
            <StatusBadge variant="danger" label="Agotado" />
          ) : isLow ? (
            <StatusBadge variant="warning" label="Bajo" />
          ) : (
            <StatusBadge variant="success" label="Disponible" />
          )}
        </div>
        <p className="mt-1 text-2xl font-semibold text-fg">{retailStock}</p>
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
    <div className="rounded-lg border border-border-subtle bg-surface-muted px-3 py-2">
      <p className="text-xs font-semibold text-fg-subtle">{label}</p>
      <p className="text-lg font-semibold text-fg">{value}</p>
    </div>
  );
}
