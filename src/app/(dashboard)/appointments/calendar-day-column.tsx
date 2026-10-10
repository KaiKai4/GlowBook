import { formatTimeTz } from "@/infra/format/dates";
import { useSalonDisplay } from "./salon-display-context";
import { formatCurrency, toAmount } from "@/infra/format/money";
import { cn } from "@/components/ui/cn";
import { isVisibleOnCalendar } from "@/features/appointments/domain/lifecycle";
import type { CalendarAppointment } from "@/features/appointments/view-models";
import {
  assignColumns,
  HOUR_HEIGHT,
  PX_PER_MIN,
  TIME_LABEL_EDGE_SPACE,
  TIME_LABEL_TOP_SPACE,
} from "./calendar-geometry";

const STATUS_CARD: Record<string, string> = {
  scheduled: "bg-info-subtle border-info text-info-strong",
  confirmed: "bg-brand-100 border-brand-500 text-brand-900",
  completed: "bg-success-subtle border-success text-success-strong",
  no_show: "bg-warning-subtle border-warning text-warning-strong",
};
const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-info",
  confirmed: "bg-brand-600",
  completed: "bg-success",
  no_show: "bg-warning",
};

export function DayColumn({
  appointments, onApptClick, calStart, totalHours, compact = false,
}: {
  appointments: CalendarAppointment[];
  onApptClick: (appt: CalendarAppointment) => void;
  calStart: number;
  totalHours: number;
  compact?: boolean;
}) {
  const { tz } = useSalonDisplay();
  const visible = appointments.filter((a) => isVisibleOnCalendar(a.status) && a.start_time);
  const { items, totalCols } = assignColumns(visible, tz, calStart);

  return (
    <div
      className="relative"
      style={{
        height: `${TIME_LABEL_TOP_SPACE + totalHours * HOUR_HEIGHT + TIME_LABEL_EDGE_SPACE}px`,
      }}
    >
      {Array.from({ length: totalHours + 1 }, (_, i) => (
        <div key={i} style={{ top: `${TIME_LABEL_TOP_SPACE + i * HOUR_HEIGHT}px` }} className="absolute left-0 right-0 border-t border-border" />
      ))}
      {Array.from({ length: totalHours }, (_, i) => (
        <div key={`h${i}`} style={{ top: `${TIME_LABEL_TOP_SPACE + i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} className="absolute left-0 right-0 border-t border-dashed border-border-subtle" />
      ))}

      {items.map(({ appt, col, startMin, endMin }) => {
        if (startMin >= totalHours * 60 || endMin <= 0) return null;
        const topPx = TIME_LABEL_TOP_SPACE + Math.max(startMin * PX_PER_MIN, 0);
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
              "hover:shadow-lift hover:-translate-y-px cursor-pointer",
              STATUS_CARD[appt.status] ?? "bg-surface-muted border-border-strong text-fg-secondary"
            )}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[appt.status] ?? "bg-fg-subtle"}`} />
              <p className="text-xs font-semibold truncate leading-tight">
                {appt.customer?.first_name}{" "}
                {compact
                  ? (appt.customer?.last_name?.charAt(0) ?? "") + "."
                  : appt.customer?.last_name}
              </p>
            </div>
            {heightPx > 40 && !compact && (
              <p className="text-xs truncate opacity-80 leading-snug">
                {appt.items.map((it) => it.service?.name).filter(Boolean).join(", ")}
              </p>
            )}
            {heightPx > 52 && !compact && (
              <p className="text-xs font-semibold opacity-90 mt-0.5">
                {appt.start_time && formatTimeTz(new Date(appt.start_time), tz)}
                {" · "}
                {formatCurrency(toAmount(appt.total_price))}
              </p>
            )}
            {compact && heightPx > 36 && (
              <p className="text-xs truncate opacity-80 leading-snug">
                {appt.items[0]?.service?.name}
              </p>
            )}
          </button>
        );
      })}

      {visible.length === 0 && !compact && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-fg-subtle">Sin citas programadas</p>
        </div>
      )}
    </div>
  );
}
