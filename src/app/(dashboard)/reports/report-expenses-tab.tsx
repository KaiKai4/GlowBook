import { formatCurrency } from "@/infra/format/dates";
import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";
import { TopExpensesChart } from "./report-charts";
import { MetricGrid, UnavailableModule } from "./report-metric-grid";
import { expenseSources } from "./report-presentation";

export function ExpensesTab({ report }: { report: OperationalReportViewModel }) {
  if (!report.modules.expenses && !report.modules.inventory) {
    return <UnavailableModule module="Gastos e inventario" />;
  }

  return (
    <div className="space-y-5">
      <MetricGrid
        cards={[
          {
            label: "Gastos totales",
            value: formatCurrency(report.totalExpenses),
            detail: expenseSources(report.modules),
            tone: "danger",
            visible: true,
          },
          {
            label: "Gastos de restock",
            value: formatCurrency(report.inventoryPurchases),
            detail: "Reposiciones de productos",
            tone: "warning",
            visible: report.modules.inventory,
          },
          {
            label: "Gastos operativos",
            value: formatCurrency(report.manualExpenses),
            detail: "Egresos registrados",
            tone: "danger",
            visible: report.modules.expenses,
          },
        ]}
      />
      <TopExpensesChart expenses={report.analytics.topExpenses} />
    </div>
  );
}
