import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";
import { BusyHoursChart } from "./report-charts";
import { MonthlyAreaChart } from "./report-area-chart";
import { MetricGrid } from "./report-metric-grid";
import { CommissionsTable } from "./report-commissions-table";

export function AppointmentsTab({
  report,
  cancelled,
}: {
  report: OperationalReportViewModel;
  cancelled: number;
}) {
  return (
    <div className="space-y-5">
      <MetricGrid
        cards={[
          {
            label: "Citas agendadas",
            value: report.totalCount.toString(),
            detail: "Registradas durante el mes",
            tone: "default",
            visible: true,
          },
          {
            label: "Citas completadas",
            value: report.completedCount.toString(),
            detail: "Finalizadas durante el mes",
            tone: "success",
            visible: true,
          },
          {
            label: "Citas canceladas",
            value: cancelled.toString(),
            detail: "Canceladas durante el mes",
            tone: "danger",
            visible: true,
          },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <MonthlyAreaChart
          title="Citas completadas por mes"
          description="Evolución de los últimos 12 meses"
          points={report.analytics.months}
          series={[
            {
              key: "completedAppointments",
              label: "Citas completadas",
              color: "var(--color-brand-600)",
              fill: "var(--color-brand-300)",
              value: (point) => point.completedAppointments,
              format: (value) => `${value} ${value === 1 ? "cita" : "citas"}`,
            },
          ]}
        />
        <BusyHoursChart points={report.analytics.busyHours} />
      </div>
      <CommissionsTable report={report} />
    </div>
  );
}
