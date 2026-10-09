import type { ReminderAppointment } from "@/features/reminders/view-models";
import { isSameLocalDay, localDateStr } from "./reminder-format";

export type Period = "pendientes_hoy" | "manana" | "48h" | "7dias";

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "pendientes_hoy", label: "Pendientes hoy" },
  { value: "manana", label: "Mañana" },
  { value: "48h", label: "Próximos 2 días" },
  { value: "7dias", label: "Próximos 7 días" },
];

export const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "scheduled", label: "Agendada" },
  { value: "confirmed", label: "Confirmada" },
];

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

function lastSentAt(appt: ReminderAppointment, manualSentAt: Record<string, string>): string | null {
  return manualSentAt[appt.id] ?? appt.last_reminder_sent_at;
}

// Citas con hora que aún no tienen recordatorio enviado hoy.
export function pendingReminders(
  appointments: ReminderAppointment[],
  manualSentAt: Record<string, string>,
  today: string,
  tz: string
): ReminderAppointment[] {
  return appointments.filter(
    (appt) => !!appt.start_time && !isSameLocalDay(lastSentAt(appt, manualSentAt), today, tz)
  );
}

export function countPendingTomorrow(
  pending: ReminderAppointment[],
  tomorrow: string,
  tz: string
): number {
  return pending.filter((appt) => !!appt.start_time && localDateStr(appt.start_time, tz) === tomorrow).length;
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
  const cutoff48 = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  return appointments.filter((appt) => {
    if (!appt.start_time) return false;
    const apptDate = localDateStr(appt.start_time, tz);
    const apptTime = new Date(appt.start_time);

    if (period === "pendientes_hoy") {
      if (apptDate !== today) return false;
      if (isSameLocalDay(lastSentAt(appt, manualSentAt), today, tz)) return false;
    }
    if (period === "manana" && apptDate !== tomorrow) return false;
    if (period === "48h" && apptTime > cutoff48) return false;

    if (empId && !appt.items.some((item) => item.employee?.id === empId)) return false;
    if (status && appt.status !== status) return false;

    return true;
  });
}

// Estado derivado de una fila. `confirmBusy` indica que esta cita ya se está confirmando.
export function reminderRowState(
  appt: ReminderAppointment,
  local: ReminderLocalState,
  today: string,
  tz: string,
  confirmBusy: boolean
): ReminderRowState {
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
