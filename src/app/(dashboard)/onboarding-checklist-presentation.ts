import type { OnboardingStepKey } from "@/features/dashboard";

export interface OnboardingStepPresentation {
  label: string;
  description: string;
  href: string;
}

// Textos y rutas del checklist de arranque. El dominio solo conoce las claves de paso.
export const ONBOARDING_STEP_PRESENTATION: Record<OnboardingStepKey, OnboardingStepPresentation> = {
  services: {
    label: "Crea tus servicios",
    description: "Define qué ofreces, su duración y precio.",
    href: "/services",
  },
  employees: {
    label: "Agrega tus colaboradores",
    description: "Tu equipo, sus horarios y los servicios que realizan.",
    href: "/employees",
  },
  customers: {
    label: "Registra tu primer cliente",
    description: "También puedes crearlos al agendar una cita.",
    href: "/customers",
  },
  appointments: {
    label: "Agenda tu primera cita",
    description: "Con servicios y colaboradores listos, todo fluye desde la agenda.",
    href: "/appointments/new",
  },
};
