import { cn } from "@/lib/utils/cn";
import { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, type, onChange, onFocus, onMouseUp, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const descriptionId = error || hint ? `${inputId}-description` : undefined;
    const isNumberInput = type === "number";

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-fg-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            "h-11 w-full rounded-lg border border-border-input bg-surface px-3 text-sm text-fg shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
            "placeholder:text-fg-subtle",
            "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-[border-color,box-shadow,background-color]",
            "disabled:bg-surface-muted disabled:cursor-not-allowed disabled:text-fg-subtle",
            error && "border-danger bg-danger-subtle/30 focus:ring-danger",
            className
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          onFocus={(event) => {
            onFocus?.(event);
            if (!isNumberInput || event.currentTarget.value !== "0") return;
            const input = event.currentTarget;
            window.setTimeout(() => {
              try {
                input.select();
              } catch {
                input.value = "";
              }
            }, 0);
          }}
          onMouseUp={(event) => {
            if (isNumberInput && event.currentTarget.value === "0") {
              event.preventDefault();
            }
            onMouseUp?.(event);
          }}
          onChange={(event) => {
            if (isNumberInput) {
              event.currentTarget.value = normalizeNumberValue(event.currentTarget.value);
            }
            onChange?.(event);
          }}
          {...props}
        />
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
      </div>
    );
  }
);
Input.displayName = "Input";

function normalizeNumberValue(value: string) {
  if (value === "") return value;
  return value.replace(/^(-?)0+(?=\d)/, "$1");
}

export { Input };
