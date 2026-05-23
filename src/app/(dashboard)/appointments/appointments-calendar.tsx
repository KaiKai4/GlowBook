"use client";

import { formatTimeTz, formatCurrency } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

const HOUR_HEIGHT = 72; // px per hour
const CAL_START = 8;
const CAL_END = 21;
const TOTAL_HOURS = CAL_END - CAL_START;
const PX_PER_MIN = HOUR_HEIGHT / 60;

const STATUS_CARD: Record<string, string> = {
  scheduled: "bg-blue-50 border-blue-300 text-blue-900",
  confirmed: "bg-violet-100 border-violet-400 text-violet-900",
  completed: "bg-emerald-50 border-emerald-300 text-emerald-900",
  no_show: "bg-amber-50 border-amber-300 text-amber-900",
};
const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-blue-400",
  confirmed: "bg-violet-500",
  completed: "bg-emerald-500",
  no_show: "bg-amber-400",
};

interface ApptCalItem {
  id: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  total_price: string | null;
  customer: { first_name: string; last_name: string } | null;
  items: Array<{ service: { name: string } | null; employee: { first_name: string } | null }>;
}

function getMinutesFromCalStart(isoStr: string, tz: string): number {
  const date = new Date(isoStr);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  return (h - CAL_START) * 60 + m;
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

export function AppointmentsCalendar({
  appointments,
  tz,
  onApptClick,
}: {
  appointments: ApptCalItem[];
  tz: string;
  onApptClick: (appt: ApptCalItem) => void;
}) {
  const visible = appointments.filter(
    (a) => a.status !== "cancelled" && a.start_time
  );
  const { items, totalCols } = assignColumns(visible, tz);

  return (
    <div className="rounded-2xl border border-violet-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-violet-50 bg-gradient-to-r from-violet-50 to-white">
        <h2 className="text-sm font-bold text-violet-700 uppercase tracking-wide">Vista del día</h2>
        <span className="text-xs text-stone-400">{visible.length} citas activas</span>
      </div>

      <div className="flex">
        {/* Time gutter */}
        <div className="w-16 shrink-0 border-r border-stone-100 bg-stone-50/50">
          <div style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }} className="relative">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={i}
                style={{ top: `${i * HOUR_HEIGHT}px` }}
                className="absolute left-0 right-0 h-px bg-stone-100"
              >
                <span className="absolute -top-2.5 left-1 text-[10px] font-semibold text-stone-400 tabular-nums">
                  {String(CAL_START + i).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Appointment area */}
        <div className="flex-1 relative" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
          {/* Hour lines */}
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div
              key={i}
              style={{ top: `${i * HOUR_HEIGHT}px` }}
              className="absolute left-0 right-0 border-t border-stone-100"
            />
          ))}

          {/* Appointment cards */}
          {items.map(({ appt, col, startMin, endMin }) => {
            const topPx = Math.max(startMin * PX_PER_MIN, 0);
            const heightPx = Math.max((endMin - startMin) * PX_PER_MIN, 32);
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
                  "absolute rounded-lg border-l-4 px-2 py-1 text-left transition-all",
                  "hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:-translate-y-px cursor-pointer",
                  STATUS_CARD[appt.status] ?? "bg-stone-50 border-stone-300 text-stone-800"
                )}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[appt.status] ?? "bg-stone-400"}`} />
                  <p className="text-[11px] font-bold truncate leading-tight">
                    {appt.customer?.first_name} {appt.customer?.last_name}
                  </p>
                </div>
                {heightPx > 36 && (
                  <p className="text-[10px] truncate opacity-75">
                    {appt.items.map((it) => it.service?.name).filter(Boolean).join(", ")}
                  </p>
                )}
                {heightPx > 52 && (
                  <p className="text-[10px] font-semibold opacity-90 mt-0.5">
                    {appt.start_time && formatTimeTz(new Date(appt.start_time), tz)}
                    {" · "}
                    {formatCurrency(Number(appt.total_price ?? 0))}
                  </p>
                )}
              </button>
            );
          })}

          {visible.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-stone-300">Sin citas programadas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
