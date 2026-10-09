import { formatCurrency } from "@/lib/utils/dates";
import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";

// Liquidación de comisiones del periodo: ingresos por empleado × su %.
export function CommissionsTable({ report }: { report: OperationalReportViewModel }) {
  const { rows, totalCommission } = report.commissions;

  return (
    <div className="overflow-hidden rounded-xl border border-brand-100 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-fg-secondary">Comisiones del mes</h3>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase text-fg-subtle">Total a pagar</p>
          <p className="text-lg font-semibold text-brand-700">{formatCurrency(totalCommission)}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-fg-subtle">
          Sin citas completadas con empleado en este mes.
        </p>
      ) : (
        <div>
          <div className="hidden grid-cols-[1.4fr_0.7fr_1fr_0.6fr_1fr] gap-3 bg-surface-muted px-5 py-2.5 text-xs font-semibold uppercase text-fg-subtle md:grid">
            <span>Empleado</span>
            <span className="text-right">Citas</span>
            <span className="text-right">Ingresos</span>
            <span className="text-right">%</span>
            <span className="text-right">Comisión</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.employeeId}
              className="grid grid-cols-2 gap-2 border-t border-border-subtle px-5 py-3 text-sm md:grid-cols-[1.4fr_0.7fr_1fr_0.6fr_1fr]"
            >
              <span className="font-semibold text-fg-secondary">{row.name}</span>
              <span className="text-right text-fg-subtle md:tabular-nums">{row.appointments}</span>
              <span className="text-right text-fg-muted tabular-nums">{formatCurrency(row.revenue)}</span>
              <span className="text-right text-fg-subtle tabular-nums">{row.commissionPct}%</span>
              <span className="text-right font-semibold text-brand-700 tabular-nums">
                {formatCurrency(row.commission)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
