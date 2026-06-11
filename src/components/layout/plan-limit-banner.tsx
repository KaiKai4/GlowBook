import { AlertTriangle, OctagonAlert } from "lucide-react";

import type { PlanLimitWarning } from "@/features/salon/use-cases/get-dashboard-shell";
import { cn } from "@/lib/utils/cn";

export function PlanLimitBanner({ warnings }: { warnings: PlanLimitWarning[] }) {
  if (warnings.length === 0) return null;

  const hasDanger = warnings.some((warning) => warning.level === "danger");

  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border px-4 py-3",
        hasDanger ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 shrink-0", hasDanger ? "text-red-600" : "text-amber-600")}>
          {hasDanger ? <OctagonAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold", hasDanger ? "text-red-800" : "text-amber-800")}>
            {hasDanger ? "Tu plan llego a uno de sus limites" : "Te estas acercando a los limites de tu plan"}
          </p>
          <ul className={cn("mt-1 space-y-0.5 text-sm", hasDanger ? "text-red-700" : "text-amber-700")}>
            {warnings.map((warning) => (
              <li key={warning.message}>{warning.message}</li>
            ))}
          </ul>
          <p className={cn("mt-1.5 text-xs", hasDanger ? "text-red-600" : "text-amber-600")}>
            Contacta a GlowBook para ampliar tu plan o agregar extras.
          </p>
        </div>
      </div>
    </div>
  );
}
