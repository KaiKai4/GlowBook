import { AlertTriangle, CheckCircle2, Circle, Info, Sparkles, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/ui/cn";

type StatusVariant = "success" | "warning" | "danger" | "info" | "accent" | "neutral";

interface StatusBadgeConfig {
  variant: StatusVariant;
  label: string;
}

interface StatusBadgeProps extends StatusBadgeConfig {
  className?: string;
}

const VARIANT_CLASS: Record<StatusVariant, string> = {
  success: "border-success-border bg-success-subtle text-success-strong",
  warning: "border-warning-border bg-warning-subtle text-warning-strong",
  danger: "border-danger-border bg-danger-subtle text-danger-strong",
  info: "border-info-border bg-info-subtle text-info-strong",
  accent: "border-accent-border bg-accent-subtle text-accent-strong",
  neutral: "border-border bg-surface-sunken text-fg-secondary",
};

const VARIANT_ICON: Record<StatusVariant, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
  accent: Sparkles,
  neutral: Circle,
};

/** Estado con icono y texto (nunca solo color). */
export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  const Icon = VARIANT_ICON[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

export type StockStatusKey = "ok" | "low" | "empty";

/** Textos de stock tal como los muestra la app (inventario sin alertas, reportes y vitrina). */
export const STOCK_STATUS_BADGES: Record<StockStatusKey, StatusBadgeConfig> = {
  ok: { variant: "success", label: "Disponible" },
  low: { variant: "warning", label: "Stock bajo" },
  empty: { variant: "danger", label: "Agotado" },
};
