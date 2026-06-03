import { formatCurrency } from "@/lib/utils/dates";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";

export function RetailStats({ retail }: { retail: RetailPageView }) {
  const recentRevenue = retail.recentSales.reduce(
    (sum, sale) => sum + Number(sale.total_amount ?? 0),
    0
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Metric label="Productos activos" value={retail.products.length} />
      <Metric label="Ventas recientes" value={retail.recentSales.length} />
      <Metric label="Ingreso reciente" value={formatCurrency(recentRevenue)} />
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
