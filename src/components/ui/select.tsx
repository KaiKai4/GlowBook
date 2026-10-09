"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { getOptions, type SelectOption } from "./select-options";
import { SelectList, type SelectListPosition } from "./select-list";

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "multiple"> {
  label?: string;
  error?: string;
  placeholder?: string;
}

const Select = forwardRef<HTMLInputElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      id,
      children,
      value,
      defaultValue,
      onChange,
      name,
      disabled,
      required,
      placeholder,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-") ?? `select-${generatedId}`;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const controlled = value !== undefined;
    const options = useMemo(() => getOptions(children), [children]);
    const fallbackValue = options[0]?.value ?? "";
    const [internalValue, setInternalValue] = useState(
      defaultValue !== undefined ? String(defaultValue) : fallbackValue
    );
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [position, setPosition] = useState<SelectListPosition>({ top: 0, left: 0, width: 0 });
    const selectedValue = controlled ? String(value) : internalValue;
    const selectedOption = options.find((option) => option.value === selectedValue);
    // La opción seleccionada se lista marcada (aria-selected): no se excluye.
    const selectableOptions = useMemo(() => options.filter((option) => !option.hidden), [options]);
    const descriptionId = error ? `${selectId}-error` : undefined;

    const updatePosition = useCallback(() => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 12;
      const listHeight = Math.min(288, Math.max(48, selectableOptions.length * 44 + 12));
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow >= listHeight || rect.top < listHeight
          ? rect.bottom + 6
          : rect.top - listHeight - 6;

      setPosition({
        top: Math.max(viewportPadding, top),
        left: Math.min(
          Math.max(rect.left, viewportPadding),
          window.innerWidth - rect.width - viewportPadding
        ),
        width: rect.width,
      });
    }, [selectableOptions.length]);

    useEffect(() => {
      if (!open) return;

      updatePosition();

      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target as Node;
        if (!triggerRef.current?.contains(target) && !listRef.current?.contains(target)) {
          setOpen(false);
        }
      };
      const handleKeyDown = (event: globalThis.KeyboardEvent) => {
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
    }, [open, selectedValue, updatePosition]);

    function selectOption(option: SelectOption) {
      if (option.disabled) return;
      if (!controlled) setInternalValue(option.value);

      onChange?.({
        target: { value: option.value },
        currentTarget: { value: option.value },
      } as ChangeEvent<HTMLSelectElement>);
      setOpen(false);
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }

    function moveActive(direction: 1 | -1) {
      if (selectableOptions.length === 0) return;
      let nextIndex = activeIndex;

      for (let attempt = 0; attempt < selectableOptions.length; attempt += 1) {
        nextIndex = (nextIndex + direction + selectableOptions.length) % selectableOptions.length;
        if (!selectableOptions[nextIndex]?.disabled) {
          setActiveIndex(nextIndex);
          break;
        }
      }
    }

    function openList() {
      const firstAvailableIndex = selectableOptions.findIndex((option) => !option.disabled);
      setActiveIndex(Math.max(0, firstAvailableIndex));
      setOpen(true);
    }

    function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!open) {
          openList();
          return;
        }
        moveActive(event.key === "ArrowDown" ? 1 : -1);
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!open) {
          openList();
          return;
        }

        const option = selectableOptions[activeIndex];
        if (option) selectOption(option);
      }
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-semibold text-fg-secondary">
            {label}
          </label>
        )}
        {name && (
          <input
            ref={ref}
            type="hidden"
            name={name}
            value={selectedValue}
            required={required}
            disabled={disabled}
          />
        )}
        <select
          aria-hidden="true"
          tabIndex={-1}
          value={selectedValue}
          disabled={disabled}
          onChange={() => undefined}
          className="hidden"
          {...props}
        >
          {children}
        </select>
        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-describedby={descriptionId}
          onClick={() => {
            if (disabled) return;
            if (open) setOpen(false);
            else openList();
          }}
          onKeyDown={handleTriggerKeyDown}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-border-input bg-surface px-3 text-left text-sm text-fg shadow-hairline transition-[border-color,box-shadow,background-color]",
            "hover:border-brand-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500",
            "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-subtle",
            open && "border-brand-500 ring-2 ring-brand-100",
            error && "border-danger bg-danger-subtle/30 focus:ring-danger",
            className
          )}
        >
          <span className={cn("truncate", !selectedOption && "text-fg-subtle")}>
            {selectedOption?.label ?? placeholder ?? "Selecciona una opcion"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-fg-subtle" />
        </button>
        {error && (
          <p id={descriptionId} className="text-xs text-danger">
            {error}
          </p>
        )}

        {open && (
          <SelectList
            listRef={listRef}
            labelledBy={selectId}
            position={position}
            options={selectableOptions}
            activeIndex={activeIndex}
            selectedValue={selectedValue}
            onHoverOption={setActiveIndex}
            onSelectOption={selectOption}
          />
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
