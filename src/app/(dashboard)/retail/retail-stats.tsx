import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency } from "@/infra/format/dates";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";

export function RetailStats({ retail }: { retail: RetailPageView }) {
  const recentRevenue = retail.recentSales.reduce(
    (sum, sale) => sum + Number(sale.total_amount ?? 0),
    0
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard label="Productos activos" value={retail.products.length} />
      <MetricCard label="Ventas recientes" value={retail.recentSales.length} />
      <MetricCard label="Ingreso reciente" value={formatCurrency(recentRevenue)} />
    </div>
  );
}
