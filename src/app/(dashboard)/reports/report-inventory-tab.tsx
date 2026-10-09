import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import { STOCK_STATUS_BADGES, StatusBadge } from "@/components/ui/status-badge";
import type { OperationalReportViewModel } from "@/features/reports/use-cases/get-operational-report";
import { ProductSalesChart } from "./report-charts";
import { UnavailableModule } from "./report-metric-grid";

export function InventoryTab({ report }: { report: OperationalReportViewModel }) {
  if (!report.modules.inventory) {
    return <UnavailableModule module="Inventario" />;
  }

  return (
    <div className="space-y-5">
      <InventoryAlertsTable alerts={report.analytics.inventoryAlerts} />
      {report.modules.retail ? (
        <ProductSalesChart products={report.analytics.productSales} months={report.analytics.months} />
      ) : (
        <UnavailableModule module="Vitrina" compact />
      )}
    </div>
  );
}

type InventoryAlert = OperationalReportViewModel["analytics"]["inventoryAlerts"][number];

const ALERT_COLUMNS: DataTableColumn<InventoryAlert>[] = [
  {
    id: "name",
    header: "Producto",
    cell: (alert) => <span className="font-medium text-fg">{alert.name}</span>,
  },
  {
    id: "retail",
    header: "Vitrina",
    align: "right",
    cell: (alert) => alert.retail,
  },
  {
    id: "internal",
    header: "Uso interno",
    align: "right",
    cell: (alert) => alert.internal,
  },
  {
    id: "storage",
    header: "Bodega",
    align: "right",
    cell: (alert) => alert.storage,
  },
  {
    id: "total",
    header: "Stock actual",
    align: "right",
    cell: (alert) => <span className="font-semibold text-fg">{alert.total}</span>,
  },
  {
    id: "minimum",
    header: "Stock mínimo",
    align: "right",
    cell: (alert) => alert.minimum,
  },
  {
    id: "state",
    header: "Estado",
    align: "right",
    cell: (alert) => (
      <StatusBadge {...(alert.state === "agotado" ? STOCK_STATUS_BADGES.empty : STOCK_STATUS_BADGES.low)} />
    ),
  },
];

function InventoryAlertsTable({ alerts }: { alerts: InventoryAlert[] }) {
  return (
    <Panel title="Alertas de inventario">
      <p className="mb-4 text-sm text-fg-subtle">Productos agotados o por debajo del mínimo configurado</p>
      <DataTable
        label="Alertas de inventario"
        columns={ALERT_COLUMNS}
        rows={alerts}
        getRowId={(alert) => alert.id}
        emptyMessage="No hay alertas de stock."
      />
    </Panel>
  );
}
