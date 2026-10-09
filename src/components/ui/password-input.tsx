"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { InputProps } from "./input";

type PasswordInputProps = Omit<InputProps, "type">;

export function PasswordInput({
  className,
  label,
  error,
  hint,
  id,
  onChange,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  const descriptionId = error || hint ? `${inputId}-description` : undefined;
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-fg-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          className={cn(
            "h-11 w-full rounded-lg border border-border-input bg-surface px-3 pr-11 text-sm text-fg shadow-hairline",
            "placeholder:text-fg-subtle",
            "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500",
            "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-subtle",
            "transition-[border-color,box-shadow,background-color]",
            error && "border-danger bg-danger-subtle/30 focus:ring-danger",
            className
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          onChange={onChange}
          {...props}
        />
        <button
          type="button"
          title={visible ? "Ocultar contraseña" : "Ver contraseña"}
          aria-label={visible ? "Ocultar contraseña" : "Ver contraseña"}
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-sunken hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
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
