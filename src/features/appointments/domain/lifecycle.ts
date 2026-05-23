export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

type Transition = {
  from: AppointmentStatus[];
  to: AppointmentStatus;
};

const ALLOWED_TRANSITIONS: Transition[] = [
  { from: ["scheduled"], to: "confirmed" },
  { from: ["scheduled", "confirmed"], to: "completed" },
  { from: ["scheduled", "confirmed"], to: "cancelled" },
  { from: ["scheduled", "confirmed"], to: "no_show" },
];

export function canTransition(
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
    throw new Error(
      `No se puede cambiar el estado de "${from}" a "${to}".`
    );
  }
}

// When a cancellation/no_show occurs, appointment items must stop blocking the calendar.
export function shouldBlockCalendar(status: AppointmentStatus): boolean {
  return status === "scheduled" || status === "confirmed";
}
