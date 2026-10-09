import { AlertTriangle, OctagonAlert } from "lucide-react";

import type { PlanLimitWarning } from "@/features/salon/use-cases/get-dashboard-shell";
import { cn } from "@/components/ui/cn";

export function PlanLimitBanner({ warnings }: { warnings: PlanLimitWarning[] }) {
  if (warnings.length === 0) return null;

  const hasDanger = warnings.some((warning) => warning.level === "danger");

  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border px-4 py-3",
        hasDanger ? "border-danger-border bg-danger-subtle" : "border-warning-border bg-warning-subtle"
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 shrink-0", hasDanger ? "text-danger" : "text-warning-fg")}>
          {hasDanger ? <OctagonAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold", hasDanger ? "text-danger-strong" : "text-warning-strong")}>
            {hasDanger ? "Tu plan llego a uno de sus límites" : "Te estas acercando a los límites de tu plan"}
          </p>
          <ul className={cn("mt-1 space-y-0.5 text-sm", hasDanger ? "text-danger-strong" : "text-warning-fg")}>
            {warnings.map((warning) => (
              <li key={warning.message}>{warning.message}</li>
            ))}
          </ul>
          <p className={cn("mt-1.5 text-xs", hasDanger ? "text-danger" : "text-warning-fg")}>
            Contacta a GlowBook para ampliar tu plan o agregar extras.
          </p>
        </div>
      </div>
    </div>
  );
}
