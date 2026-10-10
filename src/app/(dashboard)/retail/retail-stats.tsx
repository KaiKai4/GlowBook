import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency, toAmount } from "@/infra/format/money";
import type { RetailPageView } from "@/features/retail";

export function RetailStats({ retail }: { retail: RetailPageView }) {
  const recentRevenue = retail.recentSales.reduce(
    (sum, sale) => sum + toAmount(sale.total_amount),
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
