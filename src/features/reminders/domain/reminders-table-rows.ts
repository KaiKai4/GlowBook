import type { ReminderAppointment } from "../view-models";
import { reminderRowState, type ReminderLocalState, type ReminderRowState } from "./reminder-rules";

export interface ReminderTableRow {
  appt: ReminderAppointment;
  state: ReminderRowState;
  sendBusy: boolean;
  confirmBusy: boolean;
}

export interface ReminderBusyState {
  isPending: boolean;
  sendingId: string | null;
  confirmingId: string | null;
}

// Convierte las citas filtradas en filas de tabla con su estado derivado y las marcas de operación en curso.
export function toReminderTableRows(input: {
  appointments: ReminderAppointment[];
  local: ReminderLocalState;
  busy: ReminderBusyState;
  today: string;
  tz: string;
}): ReminderTableRow[] {
  const { appointments, local, busy, today, tz } = input;
  return appointments.map((appt) => {
    const confirmBusy = busy.isPending && busy.confirmingId === appt.id;
    const sendBusy = busy.isPending && busy.sendingId === appt.id;
    return {
      appt,
      state: reminderRowState({ appt, local, today, tz, confirmBusy }),
      sendBusy,
      confirmBusy,
    };
  });
}
