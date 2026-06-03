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
  const color = tone === "warn" ? "text-amber-700" : tone === "ok" ? "text-emerald-700" : "text-stone-900";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-stone-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
