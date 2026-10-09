"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import {
  format,
  getMonth,
  getYear,
  setMonth,
  setYear,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";
import {
  parseDateValue,
  shiftCalendarView,
  toDateValue,
  type DatePickerMode,
} from "./date-picker-utils";
import { CalendarHeader } from "./date-picker-header";
import { DaysView, MonthsView, YearsView } from "./date-picker-views";

interface DatePickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  compact?: boolean;
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
  granularity?: "day" | "month";
}

function parsePickerValue(
  value: string | undefined,
  granularity: "day" | "month"
): Date | null {
  if (granularity === "day") return parseDateValue(value);
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;

  const [year = NaN, month = NaN] = value.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return getYear(date) === year && getMonth(date) === month - 1 ? date : null;
}

function toMonthValue(date: Date): string {
  return format(date, "yyyy-MM");
}

export function DatePicker({
  value,
  defaultValue,
  onChange,
  name,
  label,
  hint,
  error,
  required,
  disabled,
  min,
  max,
  compact = false,
  className,
  triggerClassName,
  ariaLabel,
  granularity = "day",
}: DatePickerProps) {
  const generatedId = useId();
  const triggerId = `date-picker-${generatedId.replaceAll(":", "")}`;
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const selectedValue = controlled ? value : internalValue;
  const selectedDate = parsePickerValue(selectedValue, granularity);
  const [open, setOpen] = useState(false);
  const initialMode = granularity === "month" ? "months" : "days";
  const [mode, setMode] = useState<DatePickerMode>(initialMode);
  const [focusedDate, setFocusedDate] = useState(
    selectedDate ?? parsePickerValue(defaultValue, granularity) ?? new Date()
  );
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const descriptionId = error || hint ? `${triggerId}-description` : undefined;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = 304;
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      window.innerWidth - panelWidth - viewportPadding
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const panelHeight = 356;
    const top =
      spaceBelow >= panelHeight || rect.top < panelHeight
        ? rect.bottom + 8
        : rect.top - panelHeight - 8;

    setPosition({ top: Math.max(viewportPadding, top), left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  function openCalendar() {
    if (disabled) return;
    setFocusedDate(selectedDate ?? new Date());
    setMode(initialMode);
    setOpen((current) => !current);
  }

  function selectDate(date: Date) {
    const nextValue = granularity === "month" ? toMonthValue(date) : toDateValue(date);
    if (!controlled) setInternalValue(nextValue);
    onChange?.(nextValue);
    setFocusedDate(date);
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function isUnavailable(date: Date) {
    const dateValue = toDateValue(date);
    return Boolean((min && dateValue < min) || (max && dateValue > max));
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={triggerId} className="text-sm font-semibold text-fg-secondary">
          {label}
          {required && (
            <span className="ml-0.5 text-brand-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-label={
          ariaLabel ?? label ?? (granularity === "month" ? "Seleccionar mes" : "Seleccionar fecha")
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={descriptionId}
        onClick={openCalendar}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-lg border border-border-input bg-surface px-3 text-left text-sm text-fg shadow-hairline transition-[border-color,box-shadow,background-color]",
          "hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent",
          "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-subtle",
          compact ? "h-9 min-w-36" : "h-11",
          error && "border-danger bg-danger-subtle/30 focus:ring-danger",
          triggerClassName
        )}
      >
        <span className={cn("truncate", !selectedDate && "text-fg-subtle")}>
          {selectedDate
            ? format(
                selectedDate,
                granularity === "month"
                  ? "MMMM yyyy"
                  : compact
                    ? "dd/MM/yyyy"
                    : "d 'de' MMMM 'de' yyyy",
                { locale: es }
              )
            : granularity === "month"
              ? "Selecciona un mes"
              : "Selecciona una fecha"}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-brand-500" />
      </button>
      {error && (
        <p id={descriptionId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={descriptionId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      )}

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={granularity === "month" ? "Seleccionar mes" : "Seleccionar fecha"}
            style={{ top: position.top, left: position.left }}
            className="fixed z-[70] w-[304px] rounded-xl border border-brand-100 bg-surface p-3 shadow-popover"
          >
            <CalendarHeader
              date={focusedDate}
              mode={mode}
              onModeChange={setMode}
              granularity={granularity}
              onShift={(direction) =>
                setFocusedDate((current) =>
                  shiftCalendarView(current, mode, direction)
                )
              }
            />

            {granularity === "day" && mode === "days" && (
              <DaysView
                month={focusedDate}
                selectedDate={selectedDate}
                isUnavailable={isUnavailable}
                onSelect={selectDate}
              />
            )}
            {mode === "months" && (
              <MonthsView
                date={focusedDate}
                selectedDate={selectedDate}
                onSelect={(month) => {
                  const nextDate = setMonth(focusedDate, month);
                  if (granularity === "month") {
                    selectDate(nextDate);
                    return;
                  }
                  setFocusedDate(nextDate);
                  setMode("days");
                }}
              />
            )}
            {mode === "years" && (
              <YearsView
                date={focusedDate}
                selectedDate={selectedDate}
                onSelect={(year) => {
                  setFocusedDate((current) => setYear(current, year));
                  setMode("months");
                }}
              />
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
