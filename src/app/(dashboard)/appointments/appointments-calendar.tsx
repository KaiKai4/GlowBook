"use client";

import { formatTimeTz, formatCurrency } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

const HOUR_HEIGHT = 72;
const CAL_START = 8;
const CAL_END = 21;
const TOTAL_HOURS = CAL_END - CAL_START;
const PX_PER_MIN = HOUR_HEIGHT / 60;

const STATUS_CARD: Record<string, string> = {
  scheduled: "bg-blue-50 border-blue-400 text-blue-900",
  confirmed: "bg-violet-100 border-violet-500 text-violet-900",
  completed: "bg-emerald-50 border-emerald-400 text-emerald-900",
  no_show: "bg-amber-50 border-amber-400 text-amber-900",
};
const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-blue-500",
  confirmed: "bg-violet-600",
  completed: "bg-emerald-500",
  no_show: "bg-amber-400",
};

export interface ApptCalItem {
  id: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  total_price: string | null;
  customer: { first_name: string; last_name: string } | null;
  items: Array<{ service: { name: string } | null; employee: { first_name: string } | null }>;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMinutesFromCalStart(isoStr: string, tz: string): number {
  const date = new Date(isoStr);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  return (h - CAL_START) * 60 + m;
}

function getLocalDate(isoStr: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(isoStr));
}

function assignColumns(appts: ApptCalItem[], tz: string) {
  const result: Array<{ appt: ApptCalItem; col: number; startMin: number; endMin: number }> = [];
  const colEnds: number[] = [];
  for (const appt of appts) {
    if (!appt.start_time) continue;
    const startMin = getMinutesFromCalStart(appt.start_time, tz);
    const endMin = appt.end_time ? getMinutesFromCalStart(appt.end_time, tz) : startMin + 30;
    let col = colEnds.findIndex((e) => e <= startMin);
    if (col === -1) { col = colEnds.length; colEnds.push(endMin); }
    else colEnds[col] = endMin;
    result.push({ appt, col, startMin, endMin });
  }
  return { items: result, totalCols: Math.max(colEnds.length, 1) };
}

function DayColumn({
  appointments, tz, onApptClick, compact = false,
}: {
  appointments: ApptCalItem[];
  tz: string;
  onApptClick: (appt: ApptCalItem) => void;
  compact?: boolean;
}) {
  const visible = appointments.filter((a) => a.status !== "cancelled" && a.start_time);
  const { items, totalCols } = assignColumns(visible, tz);

  return (
    <div className="relative" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
        <div key={i} style={{ top: `${i * HOUR_HEIGHT}px` }} className="absolute left-0 right-0 border-t border-stone-200" />
      ))}
      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
        <div key={`h${i}`} style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} className="absolute left-0 right-0 border-t border-dashed border-stone-100" />
      ))}

      {items.map(({ appt, col, startMin, endMin }) => {
        if (startMin >= TOTAL_HOURS * 60 || endMin <= 0) return null;
        const topPx = Math.max(startMin * PX_PER_MIN, 0);
        const heightPx = Math.max((endMin - startMin) * PX_PER_MIN, compact ? 22 : 32);
        const widthPct = 100 / totalCols;
        const leftPct = col * widthPct;
        return (
          <button
            key={appt.id}
            onClick={() => onApptClick(appt)}
            style={{
              top: `${topPx}px`,
              height: `${heightPx}px`,
              left: `calc(${leftPct}% + 2px)`,
              width: `calc(${widthPct}% - 4px)`,
            }}
            className={cn(
              "absolute rounded-lg border-l-[3px] px-1.5 py-1 text-left transition-all",
              "hover:shadow-[0_3px_10px_rgba(0,0,0,0.18)] hover:-translate-y-px cursor-pointer",
              STATUS_CARD[appt.status] ?? "bg-stone-50 border-stone-300 text-stone-800"
            )}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[appt.status] ?? "bg-stone-400"}`} />
              <p className={cn("font-bold truncate leading-tight", compact ? "text-[10px]" : "text-[11px]")}>
                {appt.customer?.first_name}{" "}
                {compact
                  ? (appt.customer?.last_name?.charAt(0) ?? "") + "."
                  : appt.customer?.last_name}
              </p>
            </div>
            {heightPx > 40 && !compact && (
              <p className="text-[10px] truncate opacity-80 leading-snug">
                {appt.items.map((it) => it.service?.name).filter(Boolean).join(", ")}
              </p>
            )}
            {heightPx > 52 && !compact && (
              <p className="text-[10px] font-semibold opacity-90 mt-0.5">
                {appt.start_time && formatTimeTz(new Date(appt.start_time), tz)}
                {" · "}
                {formatCurrency(Number(appt.total_price ?? 0))}
              </p>
            )}
            {compact && heightPx > 36 && (
              <p className="text-[10px] truncate opacity-80 leading-snug">
                {appt.items[0]?.service?.name}
              </p>
            )}
          </button>
        );
      })}

      {visible.length === 0 && !compact && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-stone-300">Sin citas programadas</p>
        </div>
      )}
    </div>
  );
}

const TIME_GUTTER_CLASSES = "w-14 shrink-0 border-r border-stone-200 bg-stone-50/80";

function TimeGutter() {
  return (
    <div className={TIME_GUTTER_CLASSES}>
      <div style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }} className="relative">
        {Array.from({ length: TOTAL_HOURS }, (_, i) => (
          <div key={i} style={{ top: `${i * HOUR_HEIGHT}px` }} className="absolute left-0 right-0">
            <span className="absolute -top-2.5 right-1.5 text-[10px] font-bold text-stone-600 tabular-nums select-none">
              {String(CAL_START + i).padStart(2, "0")}:00
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppointmentsCalendar({
  appointments,
  tz,
  onApptClick,
  mode = "diaria",
  weekDates,
  title,
}: {
  appointments: ApptCalItem[];
  tz: string;
  onApptClick: (appt: ApptCalItem) => void;
  mode?: "diaria" | "semanal";
  weekDates?: string[];
  title?: string;
}) {
  const today = todayISO();
  const visible = appointments.filter((a) => a.status !== "cancelled" && a.start_time);

  if (mode === "semanal" && weekDates?.length === 7) {
    const byDate: Record<string, ApptCalItem[]> = {};
    for (const d of weekDates) byDate[d] = [];
    for (const appt of visible) {
      if (!appt.start_time) continue;
      const localDate = getLocalDate(appt.start_time, tz);
      if (byDate[localDate]) byDate[localDate].push(appt);
    }

    return (
      <div className="rounded-2xl border border-violet-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 bg-gradient-to-r from-violet-50 to-white">
          <h2 className="text-sm font-bold text-violet-700 uppercase tracking-wide">Vista semanal</h2>
          <span className="text-xs text-stone-500 font-medium">{visible.length} citas esta semana</span>
        </div>

        <div className="overflow-x-auto">
          {/* Day headers */}
          <div className="flex min-w-[640px] border-b border-stone-200 bg-stone-50/50">
            <div className="w-14 shrink-0" />
            {weekDates.map((d) => {
              const dt = new Date(`${d}T12:00:00`);
              const dayName = dt.toLocaleDateString("es-PA", { weekday: "short" });
              const dayNum = dt.getDate();
              const isToday = d === today;
              const count = byDate[d]?.length ?? 0;
              return (
                <div key={d} className="flex-1 min-w-[80px] text-center py-2.5 border-l border-stone-200">
                  <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">{dayName}</p>
                  <div className={cn(
                    "mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
                    isToday ? "bg-violet-600 text-white shadow-sm" : "text-stone-800"
                  )}>
                    {dayNum}
                  </div>
                  {count > 0 && (
                    <p className="text-[10px] text-violet-500 font-semibold mt-0.5">{count} cita{count > 1 ? "s" : ""}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Calendar body */}
          <div className="flex min-w-[640px]">
            <TimeGutter />
            {weekDates.map((d) => {
              const isToday = d === today;
              return (
                <div
                  key={d}
                  className={cn(
                    "flex-1 min-w-[80px] border-l border-stone-200",
                    isToday && "bg-violet-50/25"
                  )}
                >
                  <DayColumn
                    appointments={byDate[d] ?? []}
                    tz={tz}
                    onApptClick={onApptClick}
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
    <div className="rounded-2xl border border-violet-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 bg-gradient-to-r from-violet-50 to-white">
        <h2 className="text-sm font-bold text-violet-700 uppercase tracking-wide">
          {title ?? "Vista del día"}
        </h2>
        <span className="text-xs text-stone-500 font-medium">{visible.length} citas activas</span>
      </div>

      <div className="flex">
        <TimeGutter />
        <div className="flex-1">
          <DayColumn appointments={appointments} tz={tz} onApptClick={onApptClick} />
        </div>
      </div>
    </div>
  );
}
