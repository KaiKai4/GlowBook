import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { paymentMethodLabel } from "@/features/payments/domain/payment-methods";
import { formatCurrency } from "@/lib/utils/dates";

export function RetailSalesHistory({ sales }: { sales: RetailPageView["recentSales"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas recientes</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-stone-100">
        {sales.map((sale) => (
          <div key={sale.id} className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_140px_140px]">
            <div>
              <p className="font-semibold text-stone-900">{customerName(sale.customer)}</p>
              <p className="text-xs text-stone-400">{sale.note || "Sin nota"}</p>
            </div>
            <span>{paymentLabel(sale.payment_method)}</span>
            <span className="font-bold text-emerald-700">
              {formatCurrency(Number(sale.total_amount ?? 0))}
            </span>
          </div>
        ))}
        {sales.length === 0 && (
          <p className="py-8 text-center text-sm text-stone-400">Sin ventas registradas todavia.</p>
        )}
      </CardContent>
    </Card>
  );
}

function customerName(customer: RetailPageView["recentSales"][number]["customer"]) {
  const value = Array.isArray(customer) ? customer[0] : customer;
  if (!value) return "Venta sin cliente";
  return `${value.first_name} ${value.last_name}`.trim();
}

function paymentLabel(value: string) {
  return paymentMethodLabel(value);
}
