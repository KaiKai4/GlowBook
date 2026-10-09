import { CalendarCheck, PackageSearch, ReceiptText, ShoppingBag, WalletCards } from "lucide-react";
import { formatCurrency } from "@/infra/format/dates";
import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";
import { MonthlyAreaChart } from "./report-area-chart";
import { MetricGrid } from "./report-metric-grid";

export function FinanceTab({ report }: { report: OperationalReportViewModel }) {
  return (
    <div className="space-y-5">
      <MetricGrid
        cards={[
          {
            label: "Ingresos por citas",
            value: formatCurrency(report.revenue),
            detail: "Citas completadas y pagadas",
            icon: CalendarCheck,
            tone: "positive",
            visible: true,
          },
          {
            label: "Ingresos por vitrina",
            value: formatCurrency(report.retailRevenue),
            detail: "Ventas de productos",
            icon: ShoppingBag,
            tone: "blue",
            visible: report.modules.retail,
          },
          {
            label: "Ingresos totales",
            value: formatCurrency(report.grossRevenue),
            detail: report.modules.retail ? "Citas y vitrina" : "Solo citas",
            icon: WalletCards,
            tone: "positive",
            visible: true,
          },
          {
            label: "Gastos operativos",
            value: formatCurrency(report.manualExpenses),
            detail: "Egresos registrados",
            icon: ReceiptText,
            tone: "negative",
            visible: report.modules.expenses,
          },
          {
            label: "Reposiciones de inventario",
            value: formatCurrency(report.inventoryPurchases),
            detail: "Compras de productos",
            icon: PackageSearch,
            tone: "amber",
            visible: report.modules.inventory,
          },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <MonthlyAreaChart
          title="Margen de ganancia"
          description="Ganancia sobre ingresos totales por mes"
          points={report.analytics.months}
          percent
          series={[
            {
              key: "marginPct",
              label: "Margen",
              color: "var(--color-brand-600)",
              fill: "var(--color-brand-300)",
              value: (point) => point.marginPct,
            },
          ]}
        />
        <MonthlyAreaChart
          title="Ingresos por origen"
          description="Citas completadas frente a ventas de vitrina"
          points={report.analytics.months}
          series={[
            {
              key: "appointmentRevenue",
              label: "Citas",
              color: "var(--color-brand-600)",
              fill: "var(--color-brand-300)",
              value: (point) => point.appointmentRevenue,
            },
            ...(report.modules.retail
              ? [{
                  key: "retailRevenue" as const,
                  label: "Vitrina",
                  color: "var(--color-chart-info)",
                  fill: "var(--color-chart-info-soft)",
                  value: (point: OperationalReportViewModel["analytics"]["months"][number]) => point.retailRevenue,
                }]
              : []),
          ]}
        />
      </div>
      <MonthlyAreaChart
        title="Ganancias por mes"
        description="Resultado mensual después de gastos operativos y reposiciones activas"
        points={report.analytics.months}
        series={[
          {
            key: "profit",
            label: "Ganancia",
            color: "var(--color-brand-600)",
            fill: "var(--color-brand-300)",
            value: (point) => point.profit,
          },
        ]}
      />
    </div>
  );
}
