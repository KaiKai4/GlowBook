"use client";

import { useId, useRef, useState } from "react";
import { format, getMonth, getYear, setMonth, setYear } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Field } from "@/components/forms/field";
import { Popover, popoverTriggerAria } from "./popover";
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
  const panelId = `date-picker-panel-${useId()}`;
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
  const triggerRef = useRef<HTMLButtonElement>(null);

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
  }

  function isUnavailable(date: Date) {
    const dateValue = toDateValue(date);
    return Boolean((min && dateValue < min) || (max && dateValue > max));
  }

  const panelLabel = granularity === "month" ? "Seleccionar mes" : "Seleccionar fecha";

  return (
    <Field
      className={className}
      label={label}
      error={error}
      hint={hint}
      labelExtra={
        required ? (
          <span className="ml-0.5 text-brand-600" aria-hidden="true">
            *
          </span>
        ) : null
      }
    >
      {(control) => (
        <>
          {name && <input type="hidden" name={name} value={selectedValue} />}
          <button
            ref={triggerRef}
            id={control.id}
            type="button"
            disabled={disabled}
            aria-label={ariaLabel ?? label ?? panelLabel}
            {...popoverTriggerAria(open, panelId)}
            aria-describedby={control["aria-describedby"]}
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

          <Popover
            open={open}
            onDismiss={() => setOpen(false)}
            triggerRef={triggerRef}
            panelId={panelId}
            label={panelLabel}
            width={304}
            height={356}
            className="rounded-xl border border-brand-100 bg-surface p-3 shadow-popover"
          >
            <CalendarHeader
              date={focusedDate}
              mode={mode}
              onModeChange={setMode}
              granularity={granularity}
              onShift={(direction) =>
                setFocusedDate((current) => shiftCalendarView(current, mode, direction))
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
          </Popover>
        </>
      )}
    </Field>
  );
}
