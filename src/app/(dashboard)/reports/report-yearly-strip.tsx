// Acumulado del año seleccionado: se reinicia cada 1 de enero (el año nuevo
// arranca sin movimientos). El selector permite consultar años anteriores; el
// histórico completo sigue disponible en la exportación.

import { formatCurrency } from "@/lib/utils/dates";
import { Select } from "@/components/ui/select";
import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";

export function YearlyTotalsStrip({
  report,
  onChangeYear,
  pending,
}: {
  report: OperationalReportViewModel;
  onChangeYear: (year: number) => void;
  pending: boolean;
}) {
  const { yearly, selectedYear, availableYears } = report;
  const items = [
    {
      label: `Ingresos ${selectedYear}`,
      value: formatCurrency(yearly.grossRevenue),
      visible: true,
    },
    {
      label: `Egresos ${selectedYear}`,
      value: formatCurrency(yearly.totalExpenses),
      visible: report.modules.expenses || report.modules.inventory,
    },
    {
      label: `Ganancia ${selectedYear}`,
      value: formatCurrency(yearly.estimatedProfit),
      visible: true,
    },
    {
      label: `Citas completadas ${selectedYear}`,
      value: yearly.completedAppointments.toString(),
      visible: true,
    },
  ];

  return (
    <section
      aria-label={`Acumulado del año ${selectedYear}`}
      className="rounded-xl border border-border bg-surface-muted/70 px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          Acumulado del año · reinicia cada 1 de enero
        </p>
        <Select
          value={String(selectedYear)}
          onChange={(event) => onChangeYear(Number(event.target.value))}
          disabled={pending}
          className="h-9 w-32"
          title="Año del acumulado"
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              Año {year}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.filter((item) => item.visible).map((item) => (
          <div key={item.label}>
            <p className="text-xs font-medium text-fg-subtle">{item.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-fg-secondary">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
