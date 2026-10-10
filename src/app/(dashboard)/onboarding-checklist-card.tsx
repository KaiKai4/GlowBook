import Link from "next/link";
import { Check, ChevronRight, Rocket } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { OnboardingChecklist } from "@/features/dashboard";
import { ONBOARDING_STEP_PRESENTATION } from "./onboarding-checklist-presentation";

// Guia de arranque del owner: visible en el dashboard hasta completar los
// cuatro pasos; despues no vuelve a aparecer.
export function OnboardingChecklistCard({ checklist }: { checklist: OnboardingChecklist }) {
  if (checklist.complete) return null;

  const progressPct = (checklist.doneCount / checklist.steps.length) * 100;

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-surface shadow-brand-soft">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-brand-600" />
          <h2 className="text-base font-semibold text-fg">Configura tu salón</h2>
          <span className="ml-auto text-xs font-semibold text-brand-600">
            {checklist.doneCount} de {checklist.steps.length}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-brand-100/60">
        {checklist.steps.map((step, index) => {
          const view = ONBOARDING_STEP_PRESENTATION[step.key];
          return (
          <Link
            key={step.key}
            href={view.href}
            className={cn(
              "flex items-center gap-3 px-5 py-3 transition-colors",
              step.done ? "opacity-60" : "hover:bg-brand-50/60"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                step.done
                  ? "bg-success text-surface"
                  : "border-2 border-brand-300 bg-surface text-brand-600"
              )}
            >
              {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-semibold",
                  step.done ? "text-fg-subtle line-through" : "text-fg-secondary"
                )}
              >
                {view.label}
              </p>
              {!step.done && <p className="text-xs text-fg-subtle">{view.description}</p>}
            </div>
            {!step.done && <ChevronRight className="h-4 w-4 shrink-0 text-brand-400" />}
          </Link>
          );
        })}
      </div>
    </div>
  );
}
