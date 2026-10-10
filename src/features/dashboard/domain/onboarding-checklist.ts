// Checklist de arranque del owner: pasos en el orden natural de configuración
// (servicios -> colaboradores -> clientes -> primera cita). Solo guarda claves y
// estado; los textos y rutas de cada paso viven en la capa de app.

export type OnboardingStepKey = "services" | "employees" | "customers" | "appointments";

interface OnboardingStep {
  key: OnboardingStepKey;
  done: boolean;
}

export interface OnboardingChecklist {
  steps: OnboardingStep[];
  doneCount: number;
  complete: boolean;
}

export interface OnboardingCountsInput {
  services: number;
  employees: number;
  customers: number;
  appointments: number;
}

export function buildOnboardingChecklist(counts: OnboardingCountsInput): OnboardingChecklist {
  const steps: OnboardingStep[] = [
    { key: "services", done: counts.services > 0 },
    { key: "employees", done: counts.employees > 0 },
    { key: "customers", done: counts.customers > 0 },
    { key: "appointments", done: counts.appointments > 0 },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  return { steps, doneCount, complete: doneCount === steps.length };
}
