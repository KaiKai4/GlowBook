"use client";

import { cn } from "@/lib/utils/cn";
import type { CalendarAppointment } from "@/features/appointments/view-models";
import { DayColumn } from "./calendar-day-column";
import { TimeGutter } from "./calendar-time-gutter";
import {
  computeRange,
  DEFAULT_END,
  DEFAULT_START,
  getLocalDate,
  todayISO,
} from "./calendar-geometry";

export type ApptCalItem = CalendarAppointment;

export function AppointmentsCalendar({
  appointments,
  tz,
  onApptClick,
  mode = "diaria",
  weekDates,
  title,
  businessStart = DEFAULT_START,
  businessEnd = DEFAULT_END,
}: {
  appointments: ApptCalItem[];
  tz: string;
  onApptClick: (appt: ApptCalItem) => void;
  mode?: "diaria" | "semanal";
  weekDates?: string[];
  title?: string;
  businessStart?: number;
  businessEnd?: number;
}) {
  const today = todayISO();
  const visible = appointments.filter((a) => a.status !== "cancelled" && a.start_time);
  const { calStart, calEnd } = computeRange(visible, tz, businessStart, businessEnd);
  const totalHours = calEnd - calStart;

  if (mode === "semanal" && weekDates?.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-100 bg-surface shadow-tile overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-gradient-to-r from-brand-50 to-surface">
          <h2 className="text-sm font-semibold text-brand-700 uppercase tracking-wide">Vista semanal</h2>
          <span className="text-xs text-fg-subtle font-medium">Sin días abiertos</span>
        </div>
        <div className="px-5 py-12 text-center">
          <p className="text-sm font-semibold text-fg-subtle">No hay días de atención abiertos esta semana.</p>
          <p className="mt-1 text-xs text-fg-subtle">Puedes cambiarlo desde Configuración del salón.</p>
        </div>
      </div>
    );
  }

  if (mode === "semanal" && weekDates && weekDates.length > 0) {
    const byDate: Record<string, ApptCalItem[]> = {};
    for (const d of weekDates) byDate[d] = [];
    for (const appt of visible) {
      if (!appt.start_time) continue;
      const localDate = getLocalDate(appt.start_time, tz);
      if (byDate[localDate]) byDate[localDate].push(appt);
    }
    const visibleCount = weekDates.reduce((sum, d) => sum + (byDate[d]?.length ?? 0), 0);

    return (
      <div className="rounded-2xl border border-brand-100 bg-surface shadow-tile overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-gradient-to-r from-brand-50 to-surface">
          <h2 className="text-sm font-semibold text-brand-700 uppercase tracking-wide">Vista semanal</h2>
          <span className="text-xs text-fg-subtle font-medium">{visibleCount} citas esta semana</span>
        </div>

        <div className="overflow-x-auto lg:overflow-x-visible">
          {/* Day headers */}
          <div className="flex min-w-[640px] border-b border-border bg-surface-muted/50 lg:min-w-0">
            <div className="sticky left-0 z-30 w-14 shrink-0 border-r border-border bg-surface-muted/95 shadow-sticky" />
            {weekDates.map((d) => {
              const dt = new Date(`${d}T12:00:00`);
              const dayName = dt.toLocaleDateString("es-PA", { weekday: "short" });
              const dayNum = dt.getDate();
              const isToday = d === today;
              const count = byDate[d]?.length ?? 0;
              return (
                <div key={d} className="flex-1 min-w-[80px] text-center py-2.5 border-l border-border">
                  <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wider">{dayName}</p>
                  <div className={cn(
                    "mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                    isToday ? "bg-brand-600 text-surface shadow-sm" : "text-fg-secondary"
                  )}>
                    {dayNum}
                  </div>
                  {count > 0 && (
                    <p className="text-xs text-brand-500 font-semibold mt-0.5">{count} cita{count > 1 ? "s" : ""}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Calendar body */}
          <div className="flex min-w-[640px] lg:min-w-0">
            <TimeGutter
              calStart={calStart}
              totalHours={totalHours}
              labelEndHour={businessEnd}
            />
            {weekDates.map((d) => {
              const isToday = d === today;
              return (
                <div
                  key={d}
                  className={cn(
                    "flex-1 min-w-[80px] border-l border-border",
                    isToday && "bg-brand-50/25"
                  )}
                >
                  <DayColumn
                    appointments={byDate[d] ?? []}
                    tz={tz}
                    onApptClick={onApptClick}
                    calStart={calStart}
                    totalHours={totalHours}
                    compact
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Day / trabajador view
  return (
    <div className="rounded-2xl border border-brand-100 bg-surface shadow-tile overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-gradient-to-r from-brand-50 to-surface">
        <h2 className="text-sm font-semibold text-brand-700 uppercase tracking-wide">
          {title ?? "Vista del día"}
        </h2>
        <span className="text-xs text-fg-subtle font-medium">{visible.length} citas activas</span>
      </div>

      <div className="flex">
        <TimeGutter
          calStart={calStart}
          totalHours={totalHours}
          labelEndHour={businessEnd}
        />
        <div className="flex-1">
          <DayColumn
            appointments={appointments}
            tz={tz}
            onApptClick={onApptClick}
            calStart={calStart}
            totalHours={totalHours}
          />
        </div>
      </div>
    </div>
  );
}
