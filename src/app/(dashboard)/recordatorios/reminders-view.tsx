"use client";

import { useState } from "react";
import { formatCurrency, formatTimeTz } from "@/lib/utils/dates";
import { MessageCircle, ChevronDown, ChevronUp, Bell, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ApptReminder {
  id: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  total_price: string | null;
  customer: {
    first_name: string;
    last_name: string;
    phone: string | null;
  } | null;
  items: Array<{
    id: string;
    service: { name: string } | null;
    employee: { first_name: string; last_name: string } | null;
  }>;
}

interface DayGroup {
  date: string;
  label: string;
  appointments: ApptReminder[];
}

const REMINDER_TEMPLATE = (
  name: string,
  date: string,
  time: string,
  services: string
) =>
  `Hola ${name} 👋 Te recordamos que tienes una cita el *${date}* a las *${time}*.\n\n📌 Servicios: ${services}\n\nSi necesitas reagendar, no dudes en contactarnos. ¡Te esperamos!`;

function buildWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-violet-50 text-violet-700 border-violet-200",
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada", confirmed: "Confirmada",
};

const DAY_LABELS = ["Hoy", "Mañana", "Pasado mañana"];

export function RemindersView({
  appointmentsByDay,
  tz,
}: {
  appointmentsByDay: DayGroup[];
  tz: string;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleDay(date: string) {
    setCollapsed((prev) => ({ ...prev, [date]: !prev[date] }));
  }

  function sendReminder(appt: ApptReminder, dateLabel: string) {
    if (!appt.customer?.phone) return;
    const time = appt.start_time
      ? formatTimeTz(new Date(appt.start_time), tz)
      : "hora pendiente";
    const services = appt.items.map((it) => it.service?.name).filter(Boolean).join(", ");
    const msg = REMINDER_TEMPLATE(appt.customer.first_name, dateLabel, time, services);
    window.open(buildWhatsAppUrl(appt.customer.phone, msg), "_blank");
  }

  const totalPending = appointmentsByDay.reduce((s, d) => s + d.appointments.length, 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-3 rounded-xl bg-violet-50 border border-violet-100 px-5 py-3">
        <Bell className="h-5 w-5 text-violet-500" />
        <p className="text-sm font-semibold text-violet-700">
          {totalPending} citas pendientes de recordatorio en los próximos 3 días
        </p>
      </div>

      {appointmentsByDay.map((day, dayIdx) => (
        <div
          key={day.date}
          className="rounded-2xl border border-violet-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden"
        >
          {/* Day header */}
          <button
            onClick={() => toggleDay(day.date)}
            className="w-full flex items-center justify-between px-5 py-3.5 border-b border-violet-50 hover:bg-stone-50/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 shadow-sm">
                <CalendarDays className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-stone-800">{DAY_LABELS[dayIdx]}</p>
                <p className="text-xs text-stone-400 capitalize">{day.label}</p>
              </div>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">
                {day.appointments.length}
              </span>
            </div>
            {collapsed[day.date] ? (
              <ChevronDown className="h-4 w-4 text-stone-400" />
            ) : (
              <ChevronUp className="h-4 w-4 text-stone-400" />
            )}
          </button>

          {/* Appointments */}
          {!collapsed[day.date] && (
            <div className="divide-y divide-stone-100">
              {day.appointments.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-stone-400">Sin citas pendientes para este día.</p>
                </div>
              ) : (
                day.appointments.map((appt) => {
                  const hasPhone = !!appt.customer?.phone;
                  const customerName = appt.customer
                    ? `${appt.customer.first_name} ${appt.customer.last_name}`
                    : "Cliente";

                  return (
                    <div
                      key={appt.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-stone-50/40 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-choco-100 text-xs font-bold text-violet-700">
                        {customerName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-[160px]">
                        <p className="text-sm font-semibold text-stone-800">{customerName}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {appt.items.map((item) => (
                            <span
                              key={item.id}
                              className="rounded-full bg-choco-50 border border-choco-100 px-2 py-0.5 text-[11px] text-choco-600 font-medium"
                            >
                              {item.service?.name} · {item.employee?.first_name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Time */}
                      <div className="shrink-0 text-right">
                        {appt.start_time && (
                          <p className="text-sm font-bold text-violet-700">
                            {formatTimeTz(new Date(appt.start_time), tz)}
                          </p>
                        )}
                        <p className="text-xs font-bold text-stone-700">
                          {formatCurrency(Number(appt.total_price ?? 0))}
                        </p>
                      </div>

                      {/* Status */}
                      <span className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-medium shrink-0",
                        STATUS_BADGE[appt.status] ?? "bg-stone-50 text-stone-500 border-stone-200"
                      )}>
                        {STATUS_LABEL[appt.status] ?? appt.status}
                      </span>

                      {/* WhatsApp button */}
                      <button
                        onClick={() => sendReminder(appt, day.label)}
                        disabled={!hasPhone}
                        title={hasPhone ? "Enviar recordatorio por WhatsApp" : "Cliente sin número de teléfono"}
                        className={cn(
                          "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all shrink-0",
                          hasPhone
                            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:shadow-sm"
                            : "border-stone-200 bg-stone-50 text-stone-300 cursor-not-allowed"
                        )}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Recordatorio
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
