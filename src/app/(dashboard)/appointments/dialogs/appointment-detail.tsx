"use client";

import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, formatTimeTz } from "@/lib/utils/dates";
import { User, Phone, Clock, CreditCard, Timer, Pencil } from "lucide-react";

interface ApptItem {
  id: string;
  start_time: string;
  end_time: string;
  price: number;
  discount_amount?: number;
  service: { name: string; duration_minutes: number } | null;
  employee: { first_name: string; last_name: string } | null;
}

interface ApptForDetail {
  id: string; status: string;
  start_time: string | null; end_time: string | null;
  total_price: number | string | null;
  discount_amount?: number | string | null;
  completion_price_note?: string | null;
  notes: string | null;
  customer: { first_name: string; last_name: string; phone: string | null } | null;
  items: ApptItem[];
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-brand-50 text-brand-700 border-brand-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-stone-50 text-stone-500 border-stone-200",
  no_show: "bg-amber-50 text-amber-700 border-amber-200",
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", completed: "Completada",
  cancelled: "Cancelada", no_show: "No asistió",
};
const ITEM_ACCENT: Record<string, string> = {
  scheduled: "border-l-blue-400",
  confirmed: "border-l-brand-500",
  completed: "border-l-emerald-400",
  no_show: "border-l-amber-400",
};

export function AppointmentDetailDialog({
  appt, tz, open, onClose, canManage,
}: {
  appt: ApptForDetail;
  tz: string;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
}) {
  const customerName = appt.customer
    ? `${appt.customer.first_name} ${appt.customer.last_name}`
    : "Cliente desconocido";

  const accentClass = ITEM_ACCENT[appt.status] ?? "border-l-stone-300";
  const canEdit = canManage && !["completed", "cancelled", "no_show"].includes(appt.status);
  const subtotal = appt.items.reduce((sum, item) => sum + Number(item.price ?? 0), 0);
  const discountAmount = Number(appt.discount_amount ?? 0);

  return (
    <Dialog open={open} onClose={onClose} title="Detalle de cita" className="max-w-md">
      <div className="space-y-4">
        {canEdit && (
          <Link
            href={`/appointments/${appt.id}/edit`}
            className={buttonVariants({ variant: "primary", size: "sm" })}
          >
            <Pencil className="h-4 w-4" />
            Editar / reprogramar
          </Link>
        )}

        {/* Status */}
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[appt.status] ?? ""}`}>
          {STATUS_LABEL[appt.status]}
        </span>

        {/* Cliente */}
        <div className="flex items-start gap-3 rounded-xl bg-brand-50 border border-brand-200 p-3 shadow-[0_1px_4px_rgba(109,40,217,0.08)]">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 shrink-0">
            <User className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <p className="text-xs text-brand-500 font-semibold">Cliente</p>
            <p className="text-sm font-bold text-stone-800">{customerName}</p>
            {appt.customer?.phone && (
              <div className="flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3 text-stone-400" />
                <p className="text-xs text-stone-600">{appt.customer.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Horario */}
        {appt.start_time && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-brand-400 shrink-0" />
            <span className="font-bold text-brand-700">
              {formatTimeTz(new Date(appt.start_time), tz)}
              {appt.end_time && ` – ${formatTimeTz(new Date(appt.end_time), tz)}`}
            </span>
          </div>
        )}

        {/* Servicios — cada uno como card elevada */}
        <div className="space-y-2.5">
          {appt.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between rounded-xl bg-white border border-stone-200 border-l-4 ${accentClass} px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.07)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)] transition-shadow`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-stone-800 truncate">{item.service?.name}</p>
                <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5">
                  <span>{item.employee?.first_name} {item.employee?.last_name}</span>
                  <span className="text-stone-300">·</span>
                  <span className="text-brand-600 font-medium tabular-nums">
                    {formatTimeTz(new Date(item.start_time), tz)}–{formatTimeTz(new Date(item.end_time), tz)}
                  </span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
                {Number(item.discount_amount ?? 0) > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-700">
                    -{formatCurrency(Number(item.discount_amount ?? 0))}
                  </span>
                )}
                <span className="text-sm font-bold text-stone-700">
                  {formatCurrency(
                    Math.max(0, Number(item.price) - Number(item.discount_amount ?? 0))
                  )}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-stone-400 font-medium">
                  <Timer className="h-3 w-3" />
                  {item.service?.duration_minutes} min
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="rounded-xl bg-choco-50 border border-choco-200 px-4 py-3 shadow-[0_2px_6px_rgba(120,53,15,0.08)]">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm text-choco-700/80">
              <span>Subtotal servicios</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-emerald-700">
                <span>Descuento</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-choco-200 pt-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-choco-600" />
                <span className="text-sm font-bold text-choco-700">Total cobrado</span>
              </div>
              <span className="text-lg font-bold text-choco-700">
                {formatCurrency(Number(appt.total_price ?? 0))}
              </span>
            </div>
          </div>
          {appt.completion_price_note && (
            <div className="mt-3 rounded-lg bg-white/70 px-3 py-2">
              <p className="text-xs font-semibold text-choco-500">Nota de cobro</p>
              <p className="mt-1 text-sm text-choco-700">{appt.completion_price_note}</p>
            </div>
          )}
        </div>

        {/* Notas */}
        {appt.notes && (
          <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-3">
            <p className="text-xs font-semibold text-stone-500 mb-1">Notas</p>
            <p className="text-sm text-stone-700">{appt.notes}</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
