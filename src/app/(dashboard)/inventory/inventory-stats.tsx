import { MetricCard } from "@/components/ui/metric-card";
import type { InventoryPageView } from "@/features/inventory/use-cases/inventory-products";

export function InventoryStats({ inventory }: { inventory: InventoryPageView }) {
  const lowProducts = inventory.lowStock.length;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard label="Productos" value={inventory.products.length} />
      <MetricCard
        label="Bajos o agotados"
        value={lowProducts}
        tone={lowProducts > 0 ? "warning" : "success"}
      />
      <MetricCard label="Movimientos recientes" value={inventory.recentMovements.length} />
    </div>
  );
}
