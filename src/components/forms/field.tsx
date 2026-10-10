import { useId, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

// Bloque de campo: label + control + ayuda o error. Genera los ids con useId, así que
// no depende del texto del label ni de contadores globales.

interface FieldControlProps {
  id: string;
  "aria-describedby": string | undefined;
}

interface FieldProps {
  label?: string;
  // Id propio del control; si no se indica, se genera con useId.
  id?: string;
  error?: string;
  hint?: string;
  // Contenido junto al label (p. ej. asterisco de obligatorio).
  labelExtra?: ReactNode;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

export function Field({ label, id, error, hint, labelExtra, className, children }: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId}`;
  const message = error || hint;
  const messageId = message ? `${controlId}-description` : undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={controlId} className="text-sm font-semibold text-fg-secondary">
          {label}
          {labelExtra}
        </label>
      )}
      {children({ id: controlId, "aria-describedby": messageId })}
      {error ? (
        <p id={messageId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
