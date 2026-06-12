// Checklist de arranque del owner: pasos en el orden natural de configuración
// (servicios -> colaboradores -> clientes -> primera cita). Se muestra en el
// dashboard hasta completarse; despues desaparece para siempre.

export interface OnboardingStep {
  key: "services" | "employees" | "customers" | "appointments";
  label: string;
  description: string;
  href: string;
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
    {
      key: "services",
      label: "Crea tus servicios",
      description: "Define qué ofreces, su duración y precio.",
      href: "/services",
      done: counts.services > 0,
    },
    {
      key: "employees",
      label: "Agrega tus colaboradores",
      description: "Tu equipo, sus horarios y los servicios que realizan.",
      href: "/employees",
      done: counts.employees > 0,
    },
    {
      key: "customers",
      label: "Registra tu primer cliente",
      description: "También puedes crearlos al agendar una cita.",
      href: "/customers",
      done: counts.customers > 0,
    },
    {
      key: "appointments",
      label: "Agenda tu primera cita",
      description: "Con servicios y colaboradores listos, todo fluye desde la agenda.",
      href: "/appointments/new",
      done: counts.appointments > 0,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  return { steps, doneCount, complete: doneCount === steps.length };
}
