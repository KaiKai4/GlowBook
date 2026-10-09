import { cn } from "@/components/ui/cn";
import { isTimeWithinRange, toTimeValue, type TimeParts, type TimePeriod } from "./time-picker-utils";

export function PeriodColumn({
  selected,
  draft,
  min,
  max,
  maxExclusive,
  onSelect,
}: {
  selected: TimePeriod;
  draft: TimeParts;
  min?: string;
  max?: string;
  maxExclusive: boolean;
  onSelect: (period: TimePeriod) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Periodo"
      className="relative z-10 h-[180px]"
    >
      {(["AM", "PM"] as TimePeriod[]).map((period) => {
        const active = selected === period;
        const valid = isTimeWithinRange(
          toTimeValue({ ...draft, period }),
          min,
          max,
          maxExclusive
        );

        return (
          <button
            key={period}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={!valid && Boolean(min || max)}
            onClick={() => onSelect(period)}
            className={cn(
              "absolute left-0 top-[72px] flex h-9 w-full items-center justify-center rounded-md text-sm font-semibold transition-[transform,color,opacity] duration-200 ease-out",
              active
                ? "translate-y-0 text-fg"
                : period === "AM"
                  ? "-translate-y-9 text-fg-subtle"
                  : "translate-y-9 text-fg-subtle",
              "hover:text-brand-700 disabled:pointer-events-none disabled:opacity-25"
            )}
          >
            {period}
          </button>
        );
      })}
    </div>
  );
}
