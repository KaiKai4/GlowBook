import type { ComponentProps } from "react";
import type { StatusBadge } from "@/components/ui/status-badge";
import type { AppointmentStatus } from "@/features/appointments/domain/lifecycle";

type StatusBadgeProps = ComponentProps<typeof StatusBadge>;

export interface AppointmentStatusBadge {
  variant: StatusBadgeProps["variant"];
  label: string;
}

/** Texto e insignia de cada estado de cita en la agenda (nunca solo color). */
export const APPOINTMENT_STATUS_BADGE: Record<AppointmentStatus, AppointmentStatusBadge> = {
  scheduled: { variant: "info", label: "Agendada" },
  confirmed: { variant: "accent", label: "Confirmada" },
  completed: { variant: "success", label: "Completada" },
  cancelled: { variant: "neutral", label: "Cancelada" },
  no_show: { variant: "warning", label: "No asistió" },
};
