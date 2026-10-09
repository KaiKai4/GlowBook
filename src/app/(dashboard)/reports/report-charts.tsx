"use client";

import { formatCurrency } from "@/lib/utils/dates";
import type {
  BusyHourPoint,
  ProductMonthlySales,
  ReportMonthPoint,
  TopExpense,
} from "@/features/reports/domain/analytics";
import { PRODUCT_COLORS } from "./chart-layout";
import { ChartFrame, EmptyChart } from "./report-chart-frame";

export function BusyHoursChart({ points }: { points: BusyHourPoint[] }) {
  const max = Math.max(...points.map((point) => point.total), 1);
  return (
    <ChartFrame title="Horas más ocupadas" description="Distribución histórica de citas activas por hora">
      {points.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="flex h-[270px] items-end gap-2 overflow-x-auto px-2 pt-6">
          {points.map((point) => (
            <div key={point.hour} className="group flex min-w-12 flex-1 flex-col items-center justify-end gap-2">
              <span className="opacity-0 transition-opacity group-hover:opacity-100 text-xs font-semibold text-fg-secondary">
                {point.total}
              </span>
              <div
                className="w-full max-w-12 rounded-t-md bg-brand-500/80 transition-colors group-hover:bg-brand-600"
                style={{ height: `${Math.max(12, (point.total / max) * 190)}px` }}
                title={`${point.label}: ${point.total} citas`}
              />
              <span className="whitespace-nowrap text-xs font-medium text-fg-subtle">{point.label}</span>
            </div>
          ))}
        </div>
      )}
    </ChartFrame>
  );
}

export function ProductSalesChart({
  products,
  months,
}: {
  products: ProductMonthlySales[];
  months: ReportMonthPoint[];
}) {
  const max = Math.max(...products.flatMap((product) => product.months), 1);
  return (
    <ChartFrame title="Productos más vendidos por mes" description="Unidades vendidas en vitrina durante los últimos 12 meses">
      {products.length === 0 ? (
        <EmptyChart label="Aún no hay ventas de productos para graficar." />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap justify-end gap-x-4 gap-y-2">
            {products.map((product, index) => (
              <span key={product.id} className="inline-flex items-center gap-2 text-xs text-fg-muted">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PRODUCT_COLORS[index] }} />
                {product.name}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <div className="flex h-[250px] min-w-[680px] items-end gap-3 border-b border-border px-2">
              {months.map((month, monthIndex) => (
                <div key={month.monthKey} className="flex h-full flex-1 flex-col justify-end gap-2">
                  <div className="flex flex-1 items-end justify-center gap-1">
                    {products.map((product, productIndex) => (
                      <div
                        key={product.id}
                        className="w-full max-w-3 rounded-t-sm transition-opacity hover:opacity-75"
                        style={{
                          height: `${Math.max((product.months[monthIndex] ?? 0) > 0 ? 6 : 0, ((product.months[monthIndex] ?? 0) / max) * 190)}px`,
                          background: PRODUCT_COLORS[productIndex],
                        }}
                        title={`${month.label}, ${product.name}: ${product.months[monthIndex] ?? 0} unidades`}
                      />
                    ))}
                  </div>
                  <span className="pb-2 text-center text-xs font-semibold uppercase text-fg-subtle">
                    {month.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </ChartFrame>
  );
}

export function TopExpensesChart({ expenses }: { expenses: TopExpense[] }) {
  const max = Math.max(...expenses.map((expense) => expense.amount), 1);
  return (
    <ChartFrame title="Top 5 gastos" description="Conceptos con mayor egreso durante los últimos 12 meses">
      {expenses.length === 0 ? (
        <EmptyChart label="Aún no hay gastos para comparar." />
      ) : (
        <div className="space-y-5 py-3">
          {expenses.map((expense, index) => (
            <div key={expense.label}>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-danger-subtle text-xs font-semibold text-danger-strong">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium text-fg-secondary">{expense.label}</span>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-fg">
                  {formatCurrency(expense.amount)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-danger-subtle">
                <div
                  className="h-full rounded-full bg-danger-border"
                  style={{ width: `${Math.max(4, (expense.amount / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartFrame>
  );
}
