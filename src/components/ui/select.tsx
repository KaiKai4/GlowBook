"use client";

import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SelectOption {
  value: string;
  label: string;
  disabled: boolean;
  hidden: boolean;
}

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
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
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
            "flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-border-input bg-surface px-3 text-left text-sm text-fg shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color]",
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

        {open &&
          createPortal(
            <div
              ref={listRef}
              role="listbox"
              aria-labelledby={selectId}
              style={{ top: position.top, left: position.left, width: position.width }}
              className="fixed z-[80] max-h-72 overflow-y-auto rounded-xl border border-border-subtle bg-surface p-1.5 shadow-[0_18px_42px_rgba(15,23,42,0.18),0_2px_8px_rgba(15,23,42,0.08)]"
            >
              {selectableOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-fg-subtle">Sin opciones</div>
              ) : null}

              {selectableOptions.map((option, index) => {
                const active = index === activeIndex;

                return (
                  <button
                    key={`${option.value}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={option.value === selectedValue}
                    disabled={option.disabled}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option)}
                    className={cn(
                      "flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-fg-secondary transition-colors",
                      active && "bg-surface-sunken text-fg-strong",
                      option.disabled && "cursor-not-allowed text-fg-disabled hover:bg-transparent"
                    )}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>,
            document.body
          )}
      </div>
    );
  }
);
Select.displayName = "Select";

function getOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type !== "option") return [];

    const option = child as ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>;
    const label = nodeToText(option.props.children);
    const value =
      option.props.value !== undefined ? String(option.props.value) : label;

    return [
      {
        value,
        label,
        disabled: Boolean(option.props.disabled),
        hidden: Boolean(option.props.hidden),
      },
    ];
  });
}

function nodeToText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeToText(node.props.children);
  return "";
}

export { Select };
