import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExpensesPageView } from "@/features/expenses/use-cases/expenses";
import { formatCurrency } from "@/infra/format/dates";

// Desglose de los gastos del mes por categoría: barra proporcional + monto.
// Responde "¿en qué se me va el dinero este mes?" de un vistazo.
export function ExpensesCategoryBreakdown({ expenses }: { expenses: ExpensesPageView }) {
  const totals = expenses.categoryTotals;
  const [top] = totals;
  if (!top) return null;

  const max = top.amount || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos del mes por categoría</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {totals.map((total) => (
          <div key={`${total.category}:${total.label}`}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-fg-secondary">{total.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-fg">
                {formatCurrency(total.amount)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max((total.amount / max) * 100, 4)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
