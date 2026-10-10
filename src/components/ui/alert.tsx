import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type AlertVariant = "info" | "success" | "warning" | "danger";

const VARIANT_CLASS: Record<AlertVariant, string> = {
  info: "border-info-border bg-info-subtle text-info-strong",
  success: "border-success-border bg-success-subtle text-success-strong",
  warning: "border-warning-border bg-warning-subtle text-warning-strong",
  danger: "border-danger-border bg-danger-subtle text-danger-strong",
};

/**
 * Caja de aviso con tokens semánticos. Usa `role="status"` o `role="alert"`
 * solo cuando el aviso aparece tras una acción y debe anunciarse.
 */
export function Alert({
  variant,
  title,
  children,
  role,
  className,
}: {
  variant: AlertVariant;
  title?: string;
  children?: ReactNode;
  role?: "status" | "alert";
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn("rounded-lg border px-3 py-2 text-sm", VARIANT_CLASS[variant], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}
