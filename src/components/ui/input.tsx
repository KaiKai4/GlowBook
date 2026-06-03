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
    const isNumberInput = type === "number";

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-stone-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            "h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900",
            "placeholder:text-stone-400",
            "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
            "disabled:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400",
            error && "border-red-400 focus:ring-red-500",
            className
          )}
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
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-stone-400">{hint}</p>}
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
