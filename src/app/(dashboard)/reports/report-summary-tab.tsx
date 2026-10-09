import { CalendarCheck, CircleDollarSign, TrendingDown, TrendingUp, UserPlus } from "lucide-react";
import { formatCurrency } from "@/lib/utils/dates";
import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";
import { MonthlyAreaChart } from "./report-area-chart";
import { MetricGrid, type MetricCardData } from "./report-metric-grid";
import { expenseSources } from "./report-presentation";
import { YearlyTotalsStrip } from "./report-yearly-strip";

export function SummaryTab({
  report,
  onChangeYear,
  yearPending,
}: {
  report: OperationalReportViewModel;
  onChangeYear: (year: number) => void;
  yearPending: boolean;
}) {
  const cards: MetricCardData[] = [
    {
      label: "Ingresos del mes",
      value: formatCurrency(report.grossRevenue),
      detail: report.modules.retail ? "Citas y vitrina del mes elegido" : "Citas completadas del mes elegido",
      icon: CircleDollarSign,
      tone: "positive",
      visible: true,
    },
    {
      label: "Egresos del mes",
      value: formatCurrency(report.totalExpenses),
      detail: expenseSources(report.modules),
      icon: TrendingDown,
      tone: "negative",
      visible: report.modules.expenses || report.modules.inventory,
    },
    {
      label: "Ganancia del mes",
      value: formatCurrency(report.estimatedProfit),
      detail: "Ingresos menos egresos del mes",
      icon: report.estimatedProfit >= 0 ? TrendingUp : TrendingDown,
      tone: report.estimatedProfit >= 0 ? "positive" : "negative",
      visible: true,
    },
    {
      label: "Citas completadas",
      value: report.completedCount.toString(),
      detail: "Durante el mes elegido",
      icon: CalendarCheck,
      tone: "brand",
      visible: true,
    },
    {
      label: "Clientes nuevos",
      value: report.newCustomers.toString(),
      detail: "Registrados durante el mes",
      icon: UserPlus,
      tone: "blue",
      visible: true,
    },
  ];

  return (
    <div className="space-y-5">
      <MetricGrid cards={cards} />
      <YearlyTotalsStrip report={report} onChangeYear={onChangeYear} pending={yearPending} />
      <MonthlyAreaChart
        title="Ingresos vs. egresos"
        description="Comparación mensual de los últimos 12 meses"
        points={report.analytics.months}
        series={[
          {
            key: "totalRevenue",
            label: "Ingresos",
            color: "var(--color-chart-success)",
            fill: "var(--color-chart-success-soft)",
            value: (point) => point.totalRevenue,
          },
          {
            key: "totalExpenses",
            label: "Egresos",
            color: "var(--color-chart-danger)",
            fill: "var(--color-chart-danger-soft)",
            value: (point) => point.totalExpenses,
          },
        ]}
      />
    </div>
  );
}
