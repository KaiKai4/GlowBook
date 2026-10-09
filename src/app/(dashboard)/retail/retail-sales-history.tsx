import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { paymentMethodLabel } from "@/features/payments/domain/payment-methods";
import { formatCurrency } from "@/infra/format/dates";

type Sale = RetailPageView["recentSales"][number];

const SALES_LABEL = "Ventas recientes";

export function RetailSalesHistory({ sales }: { sales: RetailPageView["recentSales"] }) {
  return (
    <Panel title={SALES_LABEL}>
      <DataTable
        label={SALES_LABEL}
        columns={SALE_COLUMNS}
        rows={sales}
        getRowId={(sale) => sale.id}
        emptyMessage="Sin ventas registradas todavia."
      />
    </Panel>
  );
}

const SALE_COLUMNS: DataTableColumn<Sale>[] = [
  {
    id: "sale",
    header: "Venta",
    cell: (sale) => (
      <>
        <p className="font-semibold text-fg">{customerName(sale.customer)}</p>
        <p className="text-xs text-fg-subtle">{sale.note || "Sin nota"}</p>
      </>
    ),
  },
  {
    id: "payment",
    header: "Pago",
    secondary: true,
    cell: (sale) => paymentMethodLabel(sale.payment_method),
  },
  {
    id: "total",
    header: "Total",
    align: "right",
    cell: (sale) => (
      <span className="font-semibold text-success-fg">
        {formatCurrency(Number(sale.total_amount ?? 0))}
      </span>
    ),
  },
];

function customerName(customer: Sale["customer"]) {
  const value = Array.isArray(customer) ? customer[0] : customer;
  if (!value) return "Venta sin cliente";
  return `${value.first_name} ${value.last_name}`.trim();
}
