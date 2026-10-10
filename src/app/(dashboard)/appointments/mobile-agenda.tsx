"use client";

import { formatWeekdayDayMonth } from "@/infra/format/es-formats";
import { formatLocalDateISO, formatTimeTz } from "@/infra/format/dates";
import { formatCurrency, toAmount } from "@/infra/format/money";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { isVisibleOnCalendar } from "@/features/appointments/domain/lifecycle";
import type { CalendarAppointment } from "@/features/appointments/view-models";
import { appointmentStatusPresentation } from "./appointment-status";
import { useSalonDisplay } from "./salon-display-context";

// Agenda en lista para pantallas pequeñas: la grilla horaria del calendario
// no es usable en un teléfono. Misma data, mismos diálogos al tocar una cita.

function localDateKey(iso: string, tz: string): string {
  return formatLocalDateISO(new Date(iso), tz);
}

function dayLabel(dateKey: string): string {
  return formatWeekdayDayMonth(new Date(`${dateKey}T12:00:00.000Z`), {
    weekday: "long",
    month: "short",
    timeZone: "UTC",
  });
}

export function MobileAgenda({
  appointments,
  onApptClick,
}: {
  appointments: CalendarAppointment[];
  onApptClick: (appt: CalendarAppointment) => void;
}) {
  const { tz } = useSalonDisplay();
  // Solo citas visibles con hora de inicio: el filtro estrecha `startIso` a string.
  const visible = appointments
    .flatMap((appt) =>
      isVisibleOnCalendar(appt.status) && appt.start_time
        ? [{ appt, startIso: appt.start_time }]
        : []
    )
    .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-100 bg-surface py-12 text-center shadow-tile">
        <p className="text-sm text-fg-subtle">Sin citas programadas.</p>
      </div>
    );
  }

  const byDay = new Map<string, Array<{ appt: CalendarAppointment; startIso: string }>>();
  for (const entry of visible) {
    const key = localDateKey(entry.startIso, tz);
    const group = byDay.get(key) ?? [];
    group.push(entry);
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
            {dayAppointments.map(({ appt, startIso }) => (
              <Button
                key={appt.id}
                type="button"
                variant="ghost"
                onClick={() => onApptClick(appt)}
                className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left font-normal transition-colors hover:bg-transparent active:bg-brand-50/60"
              >
                <div className="w-16 shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-fg-secondary">
                    {formatTimeTz(new Date(startIso), tz)}
                  </p>
                  {appt.end_time && (
                    <p className="text-xs tabular-nums text-fg-subtle">
                      {formatTimeTz(new Date(appt.end_time), tz)}
                    </p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg-secondary">
                    {appt.customer?.first_name} {appt.customer?.last_name}
                  </p>
                  <div className="mt-1">
                    <StatusBadge {...appointmentStatusPresentation(appt.status)} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fg-subtle">
                    {appt.items.map((item) => item.service?.name).filter(Boolean).join(", ")}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-fg-secondary">
                  {formatCurrency(toAmount(appt.total_price))}
                </p>
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
