import { PublicError } from "@/infra/public-error";

/** Catálogo único de estados de cita (fuente de verdad del dominio). */
export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";

/** Estados terminales: la cita ya no admite cambios de agenda ni transiciones. */
const CLOSED_APPOINTMENT_STATUSES = [
  "completed",
  "cancelled",
  "no_show",
] as const satisfies readonly AppointmentStatus[];

/** Estados en los que la cita sigue activa y se le pueden enviar recordatorios. */
export const REMINDABLE_APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
] as const satisfies readonly AppointmentStatus[];

const CLOSED_SET: ReadonlySet<string> = new Set(CLOSED_APPOINTMENT_STATUSES);

export function isClosedStatus(status: string): boolean {
  return CLOSED_SET.has(status);
}

/** La agenda de una cita (fecha, hora, servicios) solo se edita mientras no está cerrada. */
export function canEditSchedule(status: string): boolean {
  return !isClosedStatus(status);
}

type Transition = {
  from: readonly AppointmentStatus[];
  to: AppointmentStatus;
};

const OPEN_STATUSES: readonly AppointmentStatus[] = ["scheduled", "confirmed"];

const ALLOWED_TRANSITIONS: Transition[] = [
  { from: ["scheduled"], to: "confirmed" },
  { from: OPEN_STATUSES, to: "completed" },
  { from: OPEN_STATUSES, to: "cancelled" },
  { from: OPEN_STATUSES, to: "no_show" },
];

function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus
): boolean {
  return ALLOWED_TRANSITIONS.some(
    (t) => t.to === to && t.from.includes(from)
  );
}

export function assertTransition(
  from: AppointmentStatus,
  to: AppointmentStatus
): void {
  if (!canTransition(from, to)) {
    throw new PublicError(
      `No se puede cambiar el estado de "${from}" a "${to}".`
    );
  }
}

// When a cancellation/no_show occurs, appointment items must stop blocking the calendar.
export function shouldBlockCalendar(status: AppointmentStatus): boolean {
  return OPEN_STATUSES.includes(status);
}
