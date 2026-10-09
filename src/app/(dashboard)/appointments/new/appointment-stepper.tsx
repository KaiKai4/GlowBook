"use client";

import { Check } from "lucide-react";
import { cn } from "@/components/ui/cn";

export function AppointmentStepper({
  steps,
  currentStep,
}: {
  steps: readonly string[];
  currentStep: number;
}) {
  return (
    <div className="flex items-center">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const done = currentStep > stepNumber;
        const active = currentStep === stepNumber;

        return (
          <div
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn("flex items-center", index < steps.length - 1 && "flex-1")}
          >
            <div className="flex items-center gap-2.5 shrink-0">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all",
                  done
                    ? "bg-success text-surface shadow-sm"
                    : active
                      ? "bg-brand-600 text-surface shadow-focus-lg"
                      : "bg-surface-sunken text-fg-muted"
                )}
              >
                {done ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Completado</span>
                  </>
                ) : (
                  stepNumber
                )}
              </div>
              <div>
                <p
                  className={cn(
                    "text-xs font-medium leading-none",
                    active ? "text-brand-600" : done ? "text-success-fg" : "text-fg-subtle"
                  )}
                >
                  Paso {stepNumber}
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    active ? "text-fg" : "text-fg-subtle"
                  )}
                >
                  {label}
                </p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 mx-4 h-0.5 rounded-full",
                  done ? "bg-success" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
