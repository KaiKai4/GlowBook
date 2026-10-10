import { cn } from "@/components/ui/cn";
import { forwardRef } from "react";
import { Field } from "@/components/forms/field";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, type, onChange, onFocus, onMouseUp, ...props }, ref) => {
    const isNumberInput = type === "number";

    return (
      <Field id={id} label={label} error={error} hint={hint}>
        {(control) => (
          <input
            ref={ref}
            id={control.id}
            type={type}
            className={cn(
              "h-11 w-full rounded-lg border border-border-input bg-surface px-3 text-sm text-fg shadow-hairline",
              "placeholder:text-fg-subtle",
              "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-[border-color,box-shadow,background-color]",
              "disabled:bg-surface-muted disabled:cursor-not-allowed disabled:text-fg-subtle",
              error && "border-danger bg-danger-subtle/30 focus:ring-danger",
              className
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={control["aria-describedby"]}
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
        )}
      </Field>
    );
  }
);
Input.displayName = "Input";

function normalizeNumberValue(value: string) {
  if (value === "") return value;
  return value.replace(/^(-?)0+(?=\d)/, "$1");
}

export { Input };
