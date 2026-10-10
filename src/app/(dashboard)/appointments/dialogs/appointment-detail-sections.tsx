import { CreditCard, MessageCircle, Phone, Timer, User } from "lucide-react";
import { formatTimeTz } from "@/infra/format/dates";
import { useSalonDisplay } from "../salon-display-context";
import { formatCurrency, toAmount } from "@/infra/format/money";
import { calculateItemChargedPrice } from "@/features/appointments/domain/pricing";

export interface ApptItem {
  id: string;
  start_time: string;
  end_time: string;
  price: number;
  discount_amount?: number;
  service: { name: string; duration_minutes: number } | null;
  employee: { first_name: string; last_name: string } | null;
}

export interface ApptForDetail {
  id: string; status: string;
  start_time: string | null; end_time: string | null;
  total_price: number | string | null;
  discount_amount?: number | string | null;
  completion_price_note?: string | null;
  notes: string | null;
  customer: { first_name: string; last_name: string; phone: string | null } | null;
  items: ApptItem[];
}

export const ITEM_ACCENT: Record<string, string> = {
  scheduled: "border-l-info",
  confirmed: "border-l-brand-500",
  completed: "border-l-success",
  no_show: "border-l-warning",
};

/** Tarjeta del cliente con su teléfono y el enlace de WhatsApp si hay número. */
export function ClientCard({
  customerName,
  phone,
  whatsappPhone,
}: {
  customerName: string;
  phone: string | null | undefined;
  whatsappPhone: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-brand-50 border border-brand-200 p-3 shadow-brand-soft">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 shrink-0">
        <User className="h-4 w-4 text-brand-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-brand-500 font-semibold">Cliente</p>
        <p className="text-sm font-semibold text-fg-secondary">{customerName}</p>
        {phone && (
          <div className="flex items-center gap-1 mt-0.5">
            <Phone className="h-3 w-3 text-fg-subtle" />
            <p className="text-xs text-fg-muted">{phone}</p>
          </div>
        )}
      </div>
      {whatsappPhone && (
        <a
          href={`https://wa.me/${whatsappPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Contactar por WhatsApp"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success-fg transition-colors hover:bg-success-border"
        >
          <MessageCircle className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

/** Lista de servicios de la cita, cada uno como card elevada. */
export function ServiceItemsList({
  items,
  accentClass,
}: {
  items: ApptItem[];
  accentClass: string;
}) {
  const { tz } = useSalonDisplay();
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-center justify-between rounded-xl bg-surface border border-border border-l-4 ${accentClass} px-4 py-3 shadow-soft hover:shadow-hover transition-shadow`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg-secondary truncate">{item.service?.name}</p>
            <p className="text-xs text-fg-subtle mt-0.5 flex items-center gap-1.5">
              <span>{item.employee?.first_name} {item.employee?.last_name}</span>
              <span className="text-fg-disabled">·</span>
              <span className="text-brand-600 font-medium tabular-nums">
                {formatTimeTz(new Date(item.start_time), tz)}–{formatTimeTz(new Date(item.end_time), tz)}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
            {toAmount(item.discount_amount) > 0 && (
              <span className="text-xs font-semibold text-success-fg">
                -{formatCurrency(toAmount(item.discount_amount))}
              </span>
            )}
            <span className="text-sm font-semibold text-fg-secondary">
              {formatCurrency(
                calculateItemChargedPrice(toAmount(item.price), toAmount(item.discount_amount))
              )}
            </span>
            <span className="flex items-center gap-0.5 text-xs text-fg-subtle font-medium">
              <Timer className="h-3 w-3" />
              {item.service?.duration_minutes} min
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Totales de la cita: subtotal, descuento, total cobrado y nota de cobro. */
export function TotalsBox({
  subtotal,
  discountAmount,
  totalPrice,
  completionNote,
}: {
  subtotal: number;
  discountAmount: number;
  totalPrice: number | string | null;
  completionNote: string | null | undefined;
}) {
  return (
    <div className="rounded-xl border border-success-border bg-success-subtle px-4 py-3 shadow-success-soft">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm text-success-strong/70">
          <span>Subtotal servicios</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex items-center justify-between text-sm text-success-fg">
            <span>Descuento</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-success-border pt-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-success-fg" />
            <span className="text-sm font-semibold text-success-strong">Total cobrado</span>
          </div>
          <span className="text-lg font-semibold text-success-strong">
            {formatCurrency(toAmount(totalPrice))}
          </span>
        </div>
      </div>
      {completionNote && (
        <div className="mt-3 rounded-lg bg-surface/70 px-3 py-2">
          <p className="text-xs font-semibold text-success-fg">Nota de cobro</p>
          <p className="mt-1 text-sm text-success-strong">{completionNote}</p>
        </div>
      )}
    </div>
  );
}
