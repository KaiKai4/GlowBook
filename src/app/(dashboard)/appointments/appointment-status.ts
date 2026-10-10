import type { ComponentProps } from "react";
import type { StatusBadge } from "@/components/ui/status-badge";
import type { AppointmentStatus } from "@/features/appointments/domain/lifecycle";

/** Variante visual de la insignia de estado (la misma que acepta StatusBadge). */
type AppointmentStatusVariant = ComponentProps<typeof StatusBadge>["variant"];

export interface AppointmentStatusPresentation {
  variant: AppointmentStatusVariant;
  label: string;
}

/** Único mapa de estado de cita a texto e insignia (nunca solo color). */
const APPOINTMENT_STATUS_PRESENTATION: Record<AppointmentStatus, AppointmentStatusPresentation> = {
  scheduled: { variant: "info", label: "Agendada" },
  confirmed: { variant: "accent", label: "Confirmada" },
  completed: { variant: "success", label: "Completada" },
  cancelled: { variant: "neutral", label: "Cancelada" },
  no_show: { variant: "warning", label: "No asistió" },
};

const UNKNOWN_STATUS_PRESENTATION: AppointmentStatusPresentation = {
  variant: "neutral",
  label: "Sin estado",
};

const PRESENTATION_BY_STATUS: ReadonlyMap<string, AppointmentStatusPresentation> = new Map(
  Object.entries(APPOINTMENT_STATUS_PRESENTATION)
);

/** Presentación de un estado; un valor fuera del catálogo cae en "Sin estado". */
export function appointmentStatusPresentation(status: string): AppointmentStatusPresentation {
  return PRESENTATION_BY_STATUS.get(status) ?? UNKNOWN_STATUS_PRESENTATION;
}
