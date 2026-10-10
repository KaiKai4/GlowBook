"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
} from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Field } from "@/components/forms/field";
import { getOptions, type SelectOption } from "./select-options";
import { Popover, popoverTriggerAria } from "./popover";

// Lo que recibe onChange: el valor elegido como texto, igual que el <select> nativo.
interface SelectChange {
  target: { value: string };
  currentTarget: { value: string };
}

type NativeSelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "size" | "multiple" | "value" | "defaultValue" | "onChange"
>;

interface SelectProps<T extends string = string> extends NativeSelectProps {
  label?: string;
  error?: string;
  placeholder?: string;
  // T lo fija quien usa el select; el componente no valida en runtime que coincida con las <option>.
  value?: T;
  defaultValue?: T;
  onChange?: (event: SelectChange) => void;
  // Ref del input oculto cuando hay `name` (lo que se envía en el formulario).
  ref?: Ref<HTMLInputElement>;
}

const LIST_ROW_HEIGHT = 44;
const LIST_MAX_HEIGHT = 288;

function Select<T extends string = string>({
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
  ref,
  ...props
}: SelectProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = `select-list-${useId()}`;
  const controlled = value !== undefined;
  const options = useMemo(() => getOptions(children), [children]);
  const fallbackValue = options[0]?.value ?? "";
  const [internalValue, setInternalValue] = useState<string>(defaultValue ?? fallbackValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedValue: string = value !== undefined ? value : internalValue;
  const selectedOption = options.find((option) => option.value === selectedValue);
  // La opción seleccionada se lista marcada (aria-selected): no se excluye.
  const selectableOptions = useMemo(() => options.filter((option) => !option.hidden), [options]);
  const listHeight = Math.min(
    LIST_MAX_HEIGHT,
    Math.max(48, selectableOptions.length * LIST_ROW_HEIGHT + 12)
  );

  function selectOption(option: SelectOption) {
    if (option.disabled) return;
    if (!controlled) setInternalValue(option.value);
    onChange?.({
      target: { value: option.value },
      currentTarget: { value: option.value },
    });
    setOpen(false);
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
    <Field id={id} label={label} error={error}>
      {(control) => (
        <>
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
            id={control.id}
            type="button"
            disabled={disabled}
            {...popoverTriggerAria(open, listId, "listbox")}
            aria-describedby={control["aria-describedby"]}
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
              {selectedOption?.label ?? placeholder ?? "Selecciona una opción"}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-fg-subtle" />
          </button>

          <Popover
            open={open}
            onDismiss={() => setOpen(false)}
            triggerRef={triggerRef}
            panelId={listId}
            role="listbox"
            labelledBy={control.id}
            height={listHeight}
            gap={6}
            focusOnOpen={false}
            className="max-h-72 overflow-y-auto rounded-xl border border-border-subtle bg-surface p-1.5 shadow-dropdown"
          >
            {selectableOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-fg-subtle">Sin opciones</div>
            ) : null}
            {selectableOptions.map((option, index) => (
              <OptionButton
                key={`${option.value}-${index}`}
                option={option}
                active={index === activeIndex}
                selected={option.value === selectedValue}
                onHover={() => setActiveIndex(index)}
                onSelect={() => selectOption(option)}
              />
            ))}
          </Popover>
        </>
      )}
    </Field>
  );
}

interface OptionButtonProps {
  option: SelectOption;
  active: boolean;
  selected: boolean;
  onHover: () => void;
  onSelect: () => void;
}

function OptionButton({ option, active, selected, onHover, onSelect }: OptionButtonProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={option.disabled}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={cn(
        "flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-fg-secondary transition-colors",
        active && "bg-surface-sunken text-fg-strong",
        option.disabled && "cursor-not-allowed text-fg-disabled hover:bg-transparent"
      )}
    >
      <span className="min-w-0 truncate">{option.label}</span>
    </button>
  );
}

export { Select };
