"use client";

import { Dialog } from "@/components/ui/dialog";
import { formatCurrency, formatTimeTz } from "@/lib/utils/dates";
import { User, Phone, Clock, CreditCard } from "lucide-react";

interface ApptItem {
  id: string;
  start_time: string;
  end_time: string;
  price: number;
  service: { name: string; duration_minutes: number } | null;
  employee: { first_name: string; last_name: string } | null;
}

interface ApptForDetail {
  id: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  total_price: string | null;
  notes: string | null;
  customer: { first_name: string; last_name: string; phone: string | null } | null;
  items: ApptItem[];
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-stone-50 text-stone-500 border-stone-200",
  no_show: "bg-amber-50 text-amber-700 border-amber-200",
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", completed: "Completada",
  cancelled: "Cancelada", no_show: "No asistió",
};

export function AppointmentDetailDialog({
  appt, tz, open, onClose,
}: {
  appt: ApptForDetail;
  tz: string;
  open: boolean;
  onClose: () => void;
}) {
  const customerName = appt.customer
    ? `${appt.customer.first_name} ${appt.customer.last_name}`
    : "Cliente desconocido";

  return (
    <Dialog open={open} onClose={onClose} title="Detalle de cita" className="max-w-md">
      <div className="space-y-4">
        {/* Status */}
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[appt.status] ?? ""}`}>
          {STATUS_LABEL[appt.status]}
        </span>

        {/* Cliente */}
        <div className="flex items-start gap-3 rounded-xl bg-violet-50 border border-violet-100 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 shrink-0">
            <User className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-violet-500 font-medium">Cliente</p>
            <p className="text-sm font-semibold text-stone-800">{customerName}</p>
            {appt.customer?.phone && (
              <div className="flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3 text-stone-400" />
                <p className="text-xs text-stone-500">{appt.customer.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Horario */}
        {appt.start_time && (
          <div className="flex items-center gap-2 text-sm text-stone-600">
            <Clock className="h-4 w-4 text-violet-400" />
            <span className="font-medium text-violet-700">
              {formatTimeTz(new Date(appt.start_time), tz)}
              {appt.end_time && ` – ${formatTimeTz(new Date(appt.end_time), tz)}`}
            </span>
          </div>
        )}

        {/* Servicios */}
        <div className="rounded-xl border border-stone-100 overflow-hidden">
          {appt.items.map((item, i) => (
            <div
              key={item.id}
              className={`flex items-center justify-between px-4 py-3 ${i < appt.items.length - 1 ? "border-b border-stone-100" : ""}`}
            >
              <div>
                <p className="text-sm font-semibold text-stone-800">{item.service?.name}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {item.employee?.first_name} {item.employee?.last_name}
                  {" · "}
                  {formatTimeTz(new Date(item.start_time), tz)}–{formatTimeTz(new Date(item.end_time), tz)}
                </p>
              </div>
              <span className="text-sm font-semibold text-stone-700 shrink-0">
                {formatCurrency(Number(item.price))}
              </span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between rounded-xl bg-choco-50 border border-choco-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-choco-600" />
            <span className="text-sm font-semibold text-choco-700">Total</span>
          </div>
          <span className="text-lg font-bold text-choco-700">
            {formatCurrency(Number(appt.total_price ?? 0))}
          </span>
        </div>

        {/* Notas */}
        {appt.notes && (
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3">
            <p className="text-xs font-medium text-stone-400 mb-1">Notas</p>
            <p className="text-sm text-stone-600">{appt.notes}</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
