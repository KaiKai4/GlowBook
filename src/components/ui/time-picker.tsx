"use client";

import { useId, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Field } from "@/components/forms/field";
import {
  formatTimeValue,
  isTimeWithinRange,
  parseTimeValue,
  resolvePeriodForRange,
  toTimeValue,
  type TimeParts,
} from "./time-picker-utils";
import { InfiniteWheel } from "./time-picker-wheel";
import { PeriodColumn } from "./time-picker-period";
import { Popover, popoverTriggerAria } from "./popover";

interface TimePickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  min?: string;
  max?: string;
  maxExclusive?: boolean;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
}

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

export function TimePicker({
  value,
  defaultValue = "09:00",
  onChange,
  name,
  label,
  required,
  disabled,
  error,
  min,
  max,
  maxExclusive = false,
  compact = false,
  className,
  ariaLabel,
}: TimePickerProps) {
  const panelId = `time-picker-panel-${useId()}`;
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlled ? value : internalValue;
  const [draft, setDraft] = useState(() => parseTimeValue(selectedValue));
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const draftValue = toTimeValue(draft);
  const valid = isTimeWithinRange(draftValue, min, max, maxExclusive);

  // Cerrar sin guardar descarta el borrador y vuelve a la hora seleccionada.
  function close() {
    setDraft(parseTimeValue(selectedValue));
    setOpen(false);
  }

  function openPicker() {
    if (disabled) return;
    setDraft(parseTimeValue(selectedValue));
    setOpen(true);
  }

  function updateDraft(patch: Partial<TimeParts>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      return {
        ...next,
        period: resolvePeriodForRange(next, min, max, maxExclusive),
      };
    });
  }

  function save() {
    if (!valid) return;
    if (!controlled) setInternalValue(draftValue);
    onChange?.(draftValue);
    setOpen(false);
  }

  return (
    <Field
      className={className}
      label={label}
      labelExtra={required ? <span className="ml-0.5 text-brand-600">*</span> : null}
      error={error}
    >
      {(control) => (
        <>
          {name && <input type="hidden" name={name} value={selectedValue} />}

          <button
            ref={triggerRef}
            id={control.id}
            type="button"
            disabled={disabled}
            aria-label={ariaLabel ?? label ?? "Seleccionar hora"}
            {...popoverTriggerAria(open, panelId)}
            onClick={openPicker}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border border-border-input bg-surface px-3 text-left text-sm text-fg transition-[border-color,box-shadow,background-color] duration-150",
              "hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100",
              "disabled:pointer-events-none disabled:bg-surface-muted disabled:text-fg-subtle disabled:opacity-60",
              compact ? "h-9 min-w-28" : "h-11",
              error && "border-danger bg-danger-subtle/30 focus:border-danger focus:ring-danger-subtle"
            )}
          >
            <Clock3 className="h-4 w-4 shrink-0 text-brand-500" />
            <span className="truncate">{formatTimeValue(selectedValue)}</span>
          </button>

          <Popover
            open={open}
            onDismiss={close}
            triggerRef={triggerRef}
            panelId={panelId}
            label="Seleccionar hora"
            width={286}
            height={314}
            className="rounded-xl bg-surface px-4 pb-4 pt-3 shadow-popover"
          >
            <h2 className="text-center text-base font-semibold text-fg">
              Seleccionar hora
            </h2>

            <div className="relative mx-auto mt-2 grid w-[222px] grid-cols-[70px_12px_70px_70px] items-center">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-1/2 h-10 -translate-y-1/2 rounded-lg border border-border bg-surface-muted/80"
              />

              <InfiniteWheel
                label="Hora"
                values={HOURS}
                selected={draft.hour}
                format={(hour) => String(hour).padStart(2, "0")}
                onSelect={(hour) => updateDraft({ hour })}
              />

              <span className="relative z-10 text-center text-sm font-semibold text-fg-subtle">
                :
              </span>

              <InfiniteWheel
                label="Minutos"
                values={MINUTES}
                selected={draft.minute}
                format={(minute) => String(minute).padStart(2, "0")}
                onSelect={(minute) => updateDraft({ minute })}
              />

              <PeriodColumn
                selected={draft.period}
                draft={draft}
                min={min}
                max={max}
                maxExclusive={maxExclusive}
                onSelect={(period) => setDraft((current) => ({ ...current, period }))}
              />
            </div>

            {!valid && (
              <p className="mt-1 text-center text-xs font-medium text-danger">
                La hora está fuera del horario disponible.
              </p>
            )}

            <div className="mt-3 flex justify-end gap-1.5 border-t border-border-subtle pt-3">
              <button
                type="button"
                onClick={close}
                className="h-9 rounded-lg px-3 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!valid}
                onClick={save}
                className="h-9 rounded-lg bg-brand-600 px-3.5 text-sm font-semibold text-surface transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          </Popover>
        </>
      )}
    </Field>
  );
}
