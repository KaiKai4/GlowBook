import { format, getMonth, getYear, isSameDay, isSameMonth, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";
import { getCalendarDays, getYearBlock, toDateValue } from "./date-picker-utils";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const MONTHS = Array.from({ length: 12 }, (_, month) =>
  format(new Date(2026, month, 1), "MMM", { locale: es }).replace(".", "")
);

export function DaysView({
  month,
  selectedDate,
  isUnavailable,
  onSelect,
}: {
  month: Date;
  selectedDate: Date | null;
  isUnavailable: (date: Date) => boolean;
  onSelect: (date: Date) => void;
}) {
  const days = getCalendarDays(month);

  return (
    <>
      <div className="grid grid-cols-7 pb-1">
        {WEEKDAYS.map((weekday, index) => (
          <span
            key={weekday}
            className={cn(
              "flex h-8 items-center justify-center text-xs font-semibold text-fg-subtle",
              index > 4 && "text-brand-500"
            )}
          >
            {weekday}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const outside = !isSameMonth(day, month);
          const unavailable = isUnavailable(day);

          return (
            <button
              key={toDateValue(day)}
              type="button"
              disabled={unavailable}
              onClick={() => onSelect(day)}
              className={cn(
                "relative flex h-9 items-center justify-center rounded-lg text-sm font-medium text-fg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500",
                "hover:bg-brand-50 hover:text-brand-700",
                outside && "text-fg-subtle",
                selected && "bg-brand-600 text-surface hover:bg-brand-700 hover:text-surface",
                unavailable && "cursor-not-allowed text-fg-disabled hover:bg-transparent hover:text-fg-disabled"
              )}
              aria-current={isToday(day) ? "date" : undefined}
              aria-pressed={selected}
              aria-label={format(day, "EEEE, d 'de' MMMM 'de' yyyy", {
                locale: es,
              })}
            >
              {format(day, "d")}
              {isToday(day) && !selected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-600" />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function MonthsView({
  date,
  selectedDate,
  onSelect,
}: {
  date: Date;
  selectedDate: Date | null;
  onSelect: (month: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2">
      {MONTHS.map((month, index) => {
        const selected =
          selectedDate &&
          getYear(selectedDate) === getYear(date) &&
          getMonth(selectedDate) === index;

        return (
          <button
            key={month}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              "h-12 rounded-lg text-sm font-semibold capitalize text-fg-secondary hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500",
              selected && "bg-brand-600 text-surface hover:bg-brand-700 hover:text-surface"
            )}
          >
            {month}
          </button>
        );
      })}
    </div>
  );
}

export function YearsView({
  date,
  selectedDate,
  onSelect,
}: {
  date: Date;
  selectedDate: Date | null;
  onSelect: (year: number) => void;
}) {
  const years = getYearBlock(getYear(date));

  return (
    <div className="grid grid-cols-3 gap-2 py-2">
      {years.map((year) => {
        const selected = selectedDate && getYear(selectedDate) === year;

        return (
          <button
            key={year}
            type="button"
            onClick={() => onSelect(year)}
            className={cn(
              "h-12 rounded-lg text-sm font-semibold text-fg-secondary hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500",
              selected && "bg-brand-600 text-surface hover:bg-brand-700 hover:text-surface"
            )}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
}
