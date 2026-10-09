import type { ReactNode } from "react";
import { format, getYear } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getYearBlock, type DatePickerMode } from "./date-picker-utils";

export function CalendarHeader({
  date,
  mode,
  onModeChange,
  granularity,
  onShift,
}: {
  date: Date;
  mode: DatePickerMode;
  onModeChange: (mode: DatePickerMode) => void;
  granularity: "day" | "month";
  onShift: (direction: -1 | 1) => void;
}) {
  const years = getYearBlock(getYear(date));
  const label =
    mode === "days"
      ? format(date, "MMMM yyyy", { locale: es })
      : mode === "months"
        ? String(getYear(date))
        : `${years[0]} - ${years.at(-1)}`;

  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() =>
          onModeChange(
            granularity === "month"
              ? mode === "years"
                ? "months"
                : "years"
              : mode === "days"
                ? "months"
                : mode === "months"
                  ? "years"
                  : "days"
          )
        }
        className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold capitalize text-fg hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-label="Cambiar vista del calendario"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      </button>
      <div className="flex items-center gap-1">
        <CalendarArrow
          label={mode === "days" ? "Mes anterior" : mode === "months" ? "Año anterior" : "Años anteriores"}
          onClick={() => onShift(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </CalendarArrow>
        <CalendarArrow
          label={mode === "days" ? "Mes siguiente" : mode === "months" ? "Año siguiente" : "Años siguientes"}
          onClick={() => onShift(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </CalendarArrow>
      </div>
    </div>
  );
}

function CalendarArrow({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      {children}
    </button>
  );
}
