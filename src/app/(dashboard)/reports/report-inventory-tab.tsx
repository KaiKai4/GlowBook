import { cn } from "@/lib/utils/cn";
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

function InventoryAlertsTable({
  alerts,
}: {
  alerts: OperationalReportViewModel["analytics"]["inventoryAlerts"];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-brand-100 bg-surface shadow-sm">
      <div className="border-b border-border-subtle px-5 py-4">
        <h2 className="text-base font-semibold text-fg">Alertas de inventario</h2>
        <p className="mt-1 text-sm text-fg-subtle">Productos agotados o por debajo del mínimo configurado</p>
      </div>
      {alerts.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-fg-subtle">No hay alertas de stock.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface-muted text-xs font-semibold text-fg-subtle">
              <tr>
                <th className="px-5 py-3">Producto</th>
                <th className="px-4 py-3 text-right">Vitrina</th>
                <th className="px-4 py-3 text-right">Uso interno</th>
                <th className="px-4 py-3 text-right">Bodega</th>
                <th className="px-4 py-3 text-right">Stock actual</th>
                <th className="px-4 py-3 text-right">Stock mínimo</th>
                <th className="px-5 py-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="px-5 py-4 font-medium text-fg">{alert.name}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-fg-muted">{alert.retail}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-fg-muted">{alert.internal}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-fg-muted">{alert.storage}</td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums text-fg">{alert.total}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-fg-muted">{alert.minimum}</td>
                  <td className="px-5 py-4 text-right">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        alert.state === "agotado" ? "bg-danger-subtle text-danger-strong" : "bg-warning-subtle text-warning-fg"
                      )}
                    >
                      {alert.state === "agotado" ? "Agotado" : "Stock bajo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
