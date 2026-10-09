"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
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
  const generatedId = useId();
  const triggerId = `time-picker-${generatedId.replaceAll(":", "")}`;
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlled ? value : internalValue;
  const [draft, setDraft] = useState(() => parseTimeValue(selectedValue));
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const draftValue = toTimeValue(draft);
  const valid = isTimeWithinRange(draftValue, min, max, maxExclusive);

  const close = useCallback(() => {
    setDraft(parseTimeValue(selectedValue));
    setOpen(false);
  }, [selectedValue]);

  const positionPanel = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelWidth = 286;
    const panelHeight = 314;
    const margin = 12;
    const left = Math.min(
      Math.max(rect.left, margin),
      window.innerWidth - panelWidth - margin
    );
    const top =
      window.innerHeight - rect.bottom >= panelHeight || rect.top < panelHeight
        ? rect.bottom + 8
        : rect.top - panelHeight - 8;

    setPosition({ top: Math.max(margin, top), left });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionPanel();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [close, open, positionPanel]);

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
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={triggerId}
          className="text-sm font-semibold text-fg-secondary"
        >
          {label}
          {required && <span className="ml-0.5 text-brand-600">*</span>}
        </label>
      )}

      {name && <input type="hidden" name={name} value={selectedValue} />}

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? label ?? "Seleccionar hora"}
        aria-haspopup="dialog"
        aria-expanded={open}
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

      {error && <p className="text-xs font-medium text-danger">{error}</p>}

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Seleccionar hora"
            style={{ top: position.top, left: position.left }}
            className="fixed z-[70] w-[286px] rounded-xl bg-surface px-4 pb-4 pt-3 shadow-popover"
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
          </div>,
          document.body
        )}
    </div>
  );
}
