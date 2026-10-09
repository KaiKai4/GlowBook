import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import { formatCurrency } from "@/infra/format/dates";
import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";

type CommissionRow = OperationalReportViewModel["commissions"]["rows"][number];

const COMMISSION_COLUMNS: DataTableColumn<CommissionRow>[] = [
  {
    id: "employee",
    header: "Empleado",
    cell: (row) => <span className="font-semibold text-fg-secondary">{row.name}</span>,
  },
  {
    id: "appointments",
    header: "Citas",
    align: "right",
    cell: (row) => row.appointments,
  },
  {
    id: "revenue",
    header: "Ingresos",
    align: "right",
    cell: (row) => formatCurrency(row.revenue),
  },
  {
    id: "pct",
    header: "%",
    align: "right",
    cell: (row) => `${row.commissionPct}%`,
  },
  {
    id: "commission",
    header: "Comisión",
    align: "right",
    cell: (row) => <span className="font-semibold text-brand-700">{formatCurrency(row.commission)}</span>,
  },
];

// Liquidación de comisiones del periodo: ingresos por empleado × su %.
export function CommissionsTable({ report }: { report: OperationalReportViewModel }) {
  const { rows, totalCommission } = report.commissions;

  return (
    <Panel
      title="Comisiones del mes"
      actions={
        <div className="text-right">
          <p className="text-xs font-semibold uppercase text-fg-subtle">Total a pagar</p>
          <p className="text-lg font-semibold text-brand-700">{formatCurrency(totalCommission)}</p>
        </div>
      }
    >
      <DataTable
        label="Comisiones del mes"
        columns={COMMISSION_COLUMNS}
        rows={rows}
        getRowId={(row) => row.employeeId}
        emptyMessage="Sin citas completadas con empleado en este mes."
      />
    </Panel>
  );
}
