import { MetricCard } from "@/components/ui/metric-card";
import type { ExpensesPageView } from "@/features/expenses";
import { formatCurrency } from "@/infra/format/money";

// Mensual + acumulado + la categoría que más pesa este mes: lo que un dueño
// quiere saber de un vistazo sobre sus egresos.
export function ExpensesStats({ expenses }: { expenses: ExpensesPageView }) {
  const top = expenses.topCategory;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Egresos este mes" value={formatCurrency(expenses.monthTotal)} />
      <MetricCard
        label="Mayor gasto del mes"
        value={top ? formatCurrency(top.amount) : "—"}
        help={top?.label ?? "Sin gastos este mes"}
      />
      <MetricCard label="Egresos históricos" value={formatCurrency(expenses.lifetimeTotal)} />
      <MetricCard label="Movimientos (histórico)" value={expenses.history.length} />
    </div>
  );
}
