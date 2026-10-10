import type { ReminderAppointment } from "../view-models";
import { isSameLocalDay, localDateStr } from "./local-date";

export type Period = "pendientes_hoy" | "manana" | "48h" | "7dias";

// Ventana de la vista "Próximos 2 días": 48 horas desde el momento de consulta.
const REMINDER_WINDOW_MS = 48 * 60 * 60 * 1000;

// Estado local de la vista que sobrescribe lo que llega del servidor tras una acción.
export interface ReminderLocalState {
  manualSentAt: Record<string, string>;
  manualStatus: Record<string, string>;
  readyToConfirm: Record<string, boolean>;
}

export interface ReminderRowState {
  sentAt: string | null;
  sentToday: boolean;
  hasPhone: boolean;
  currentStatus: string;
  hasReminderContact: boolean;
  canConfirm: boolean;
}

export interface ReminderFilters {
  appointments: ReminderAppointment[];
  period: Period;
  empId: string;
  status: string;
  manualSentAt: Record<string, string>;
  today: string;
  tomorrow: string;
  tz: string;
  now: Date;
}

function lastSentAt(appt: ReminderAppointment, manualSentAt: Record<string, string>): string | null {
  return manualSentAt[appt.id] ?? appt.last_reminder_sent_at;
}

// Citas con hora que aún no tienen recordatorio enviado hoy.
export function pendingReminders(input: {
  appointments: ReminderAppointment[];
  manualSentAt: Record<string, string>;
  today: string;
  tz: string;
}): ReminderAppointment[] {
  const { appointments, manualSentAt, today, tz } = input;
  return appointments.filter(
    (appt) => !!appt.start_time && !isSameLocalDay(lastSentAt(appt, manualSentAt), today, tz)
  );
}

export function countPendingTomorrow(input: {
  pending: ReminderAppointment[];
  tomorrow: string;
  tz: string;
}): number {
  const { pending, tomorrow, tz } = input;
  return pending.filter((appt) => !!appt.start_time && localDateStr(appt.start_time, tz) === tomorrow).length;
}

export function filterReminders({
  appointments,
  period,
  empId,
  status,
  manualSentAt,
  today,
  tomorrow,
  tz,
  now,
}: ReminderFilters): ReminderAppointment[] {
  const cutoff = new Date(now.getTime() + REMINDER_WINDOW_MS);

  return appointments.filter((appt) => {
    if (!appt.start_time) return false;
    const apptDate = localDateStr(appt.start_time, tz);
    const apptTime = new Date(appt.start_time);

    if (period === "pendientes_hoy") {
      if (apptDate !== today) return false;
      if (isSameLocalDay(lastSentAt(appt, manualSentAt), today, tz)) return false;
    }
    if (period === "manana" && apptDate !== tomorrow) return false;
    if (period === "48h" && apptTime > cutoff) return false;

    if (empId && !appt.items.some((item) => item.employee?.id === empId)) return false;
    if (status && appt.status !== status) return false;

    return true;
  });
}

// Estado derivado de una fila. `confirmBusy` indica que esta cita ya se está confirmando.
export function reminderRowState(input: {
  appt: ReminderAppointment;
  local: ReminderLocalState;
  today: string;
  tz: string;
  confirmBusy: boolean;
}): ReminderRowState {
  const { appt, local, today, tz, confirmBusy } = input;
  const sentAt = lastSentAt(appt, local.manualSentAt);
  const currentStatus = local.manualStatus[appt.id] ?? appt.status;
  const hasReminderContact = Boolean(sentAt) || Boolean(local.readyToConfirm[appt.id]);

  return {
    sentAt,
    sentToday: isSameLocalDay(sentAt, today, tz),
    hasPhone: !!appt.customer?.phone,
    currentStatus,
    hasReminderContact,
    canConfirm: currentStatus === "scheduled" && hasReminderContact && !confirmBusy,
  };
}
