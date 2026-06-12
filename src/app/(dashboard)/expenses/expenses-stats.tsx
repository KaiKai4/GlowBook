import type { ExpensesPageView } from "@/features/expenses/use-cases/expenses";
import { formatCurrency } from "@/lib/utils/dates";

// Mensual y acumulado lado a lado: sin ambiguedad sobre que suma cada cifra.
export function ExpensesStats({ expenses }: { expenses: ExpensesPageView }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Metric label="Egresos este mes" value={formatCurrency(expenses.monthTotal)} />
      <Metric label="Egresos históricos" value={formatCurrency(expenses.lifetimeTotal)} />
      <Metric label="Movimientos (histórico)" value={expenses.history.length} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
    </div>
  );
}
