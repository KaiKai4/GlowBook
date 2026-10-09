"use client";

import { formatCurrency, formatTimeTz } from "@/infra/format/dates";
import { cn } from "@/components/ui/cn";
import type { CalendarAppointment } from "@/features/appointments/view-models";

// Agenda en lista para pantallas pequeñas: la grilla horaria del calendario
// no es usable en un teléfono. Misma data, mismos diálogos al tocar una cita.

const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-info",
  confirmed: "bg-brand-600",
  completed: "bg-success",
  no_show: "bg-warning",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Completada",
  no_show: "No asistió",
};

function localDateKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
}

function dayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("es-PA", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

export function MobileAgenda({
  appointments,
  tz,
  onApptClick,
}: {
  appointments: CalendarAppointment[];
  tz: string;
  onApptClick: (appt: CalendarAppointment) => void;
}) {
  const visible = appointments
    .filter((appt) => appt.status !== "cancelled" && appt.start_time)
    .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-100 bg-surface py-12 text-center shadow-tile">
        <p className="text-sm text-fg-subtle">Sin citas programadas.</p>
      </div>
    );
  }

  const byDay = new Map<string, CalendarAppointment[]>();
  for (const appt of visible) {
    const key = localDateKey(appt.start_time!, tz);
    const group = byDay.get(key) ?? [];
    group.push(appt);
    byDay.set(key, group);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-surface shadow-tile">
      {[...byDay.entries()].map(([dateKey, dayAppointments]) => (
        <div key={dateKey}>
          <div className="border-b border-brand-100 bg-brand-50/60 px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 capitalize">
              {dayLabel(dateKey)}
              <span className="ml-2 font-medium normal-case text-fg-subtle">
                {dayAppointments.length} cita{dayAppointments.length === 1 ? "" : "s"}
              </span>
            </p>
          </div>
          <div className="divide-y divide-border-subtle">
            {dayAppointments.map((appt) => (
              <button
                key={appt.id}
                type="button"
                onClick={() => onApptClick(appt)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-brand-50/60"
              >
                <div className="w-16 shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-fg-secondary">
                    {formatTimeTz(new Date(appt.start_time!), tz)}
                  </p>
                  {appt.end_time && (
                    <p className="text-xs tabular-nums text-fg-subtle">
                      {formatTimeTz(new Date(appt.end_time), tz)}
                    </p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        STATUS_DOT[appt.status] ?? "bg-fg-subtle"
                      )}
                    />
                    <p className="truncate text-sm font-semibold text-fg-secondary">
                      {appt.customer?.first_name} {appt.customer?.last_name}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fg-subtle">
                    {appt.items.map((item) => item.service?.name).filter(Boolean).join(", ") ||
                      STATUS_LABEL[appt.status]}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-fg-secondary">
                  {formatCurrency(Number(appt.total_price ?? 0))}
                </p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
