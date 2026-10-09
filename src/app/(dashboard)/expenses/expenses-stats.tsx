import type { ExpensesPageView } from "@/features/expenses/use-cases/expenses";
import { formatCurrency } from "@/lib/utils/dates";

// Mensual + acumulado + la categoría que más pesa este mes: lo que un dueño
// quiere saber de un vistazo sobre sus egresos.
export function ExpensesStats({ expenses }: { expenses: ExpensesPageView }) {
  const top = expenses.topCategory;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Metric label="Egresos este mes" value={formatCurrency(expenses.monthTotal)} />
      <Metric
        label="Mayor gasto del mes"
        value={top ? formatCurrency(top.amount) : "—"}
        hint={top?.label ?? "Sin gastos este mes"}
      />
      <Metric label="Egresos históricos" value={formatCurrency(expenses.lifetimeTotal)} />
      <Metric label="Movimientos (histórico)" value={expenses.history.length} />
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase text-fg-subtle">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-fg">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}
