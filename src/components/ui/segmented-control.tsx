import { cn } from "@/components/ui/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Selector de una opción entre varias, con botones `aria-pressed` dentro de un `role="group"`.
 * Solo cambia el valor seleccionado; la lógica que reacciona al cambio vive fuera.
 *
 * Cambio de accesibilidad aceptado: la agenda usaba botones sin estado ARIA, así que los
 * lectores de pantalla ahora anuncian la vista activa y el grupo. El aspecto visual no cambia.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  className,
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center rounded-lg border border-border bg-surface-muted p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
              selected
                ? "bg-surface text-brand-700 shadow-sm border border-brand-100"
                : "text-fg-subtle hover:text-fg-secondary"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
