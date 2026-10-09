import type { InventoryPageView } from "@/features/inventory/use-cases/inventory-products";

export function InventoryStats({ inventory }: { inventory: InventoryPageView }) {
  const lowProducts = inventory.lowStock.length;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Metric label="Productos" value={inventory.products.length} />
      <Metric label="Bajos o agotados" value={lowProducts} tone={lowProducts > 0 ? "warn" : "ok"} />
      <Metric label="Movimientos recientes" value={inventory.recentMovements.length} />
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warn" | "ok";
}) {
  const color = tone === "warn" ? "text-warning-fg" : tone === "ok" ? "text-success-fg" : "text-fg";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase text-fg-subtle">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
