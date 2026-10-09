import { describe, expect, it } from "vitest";
import type { ReminderAppointment } from "@/features/reminders/view-models";
import {
  countPendingTomorrow,
  filterReminders,
  pendingReminders,
  reminderRowState,
  type ReminderLocalState,
} from "./reminder-rules";

const TZ = "America/Panama";
const TODAY = "2026-06-12";
const TOMORROW = "2026-06-13";
// 12:00 UTC es las 07:00 en Panamá: las 48 h llegan hasta el 14 de junio a las 07:00.
const NOW = new Date("2026-06-12T12:00:00.000Z");
const EMPTY_LOCAL: ReminderLocalState = { manualSentAt: {}, manualStatus: {}, readyToConfirm: {} };

function appt(id: string, overrides: Partial<ReminderAppointment> = {}): ReminderAppointment {
  return {
    id,
    status: "scheduled",
    start_time: "2026-06-12T15:00:00.000Z",
    total_price: 25,
    last_reminder_sent_at: null,
    last_reminder_channel: null,
    customer: { first_name: "Lucía", last_name: "Gómez", phone: "+507 6000-1234" },
    items: [{ id: `${id}-item`, service: { name: "Corte" }, employee: { id: "emp-1", first_name: "Ana", last_name: "Vega" } }],
    ...overrides,
  };
}

// A: hoy sin recordatorio. B: mañana confirmada. C: hoy ya recordada hoy. D: dentro de una semana. E: sin hora.
const TODAY_PENDING = appt("A");
const TOMORROW_CONFIRMED = appt("B", { start_time: "2026-06-13T15:00:00.000Z", status: "confirmed" });
const TODAY_SENT = appt("C", { last_reminder_sent_at: "2026-06-12T14:00:00.000Z" });
const NEXT_WEEK = appt("D", { start_time: "2026-06-20T15:00:00.000Z" });
const NO_TIME = appt("E", { start_time: null });
const ALL = [TODAY_PENDING, TOMORROW_CONFIRMED, TODAY_SENT, NEXT_WEEK, NO_TIME];

function ids(list: ReminderAppointment[]): string[] {
  return list.map((item) => item.id);
}

describe("pendingReminders y countPendingTomorrow", () => {
  it("omite citas sin hora y las ya recordadas hoy", () => {
    expect(ids(pendingReminders(ALL, {}, TODAY, TZ))).toEqual(["A", "B", "D"]);
  });

  it("tiene en cuenta el envío registrado localmente en la sesión", () => {
    const pending = pendingReminders(ALL, { A: "2026-06-12T16:00:00.000Z" }, TODAY, TZ);
    expect(ids(pending)).toEqual(["B", "D"]);
  });

  it("cuenta solo los pendientes de mañana", () => {
    const pending = pendingReminders(ALL, {}, TODAY, TZ);
    expect(countPendingTomorrow(pending, TOMORROW, TZ)).toBe(1);
  });
});

describe("filterReminders", () => {
  const base = { appointments: ALL, empId: "", status: "", manualSentAt: {}, today: TODAY, tomorrow: TOMORROW, tz: TZ, now: NOW };

  it("pendientes_hoy muestra solo citas de hoy que no se recordaron hoy", () => {
    expect(ids(filterReminders({ ...base, period: "pendientes_hoy" }))).toEqual(["A"]);
  });

  it("manana muestra solo las citas de mañana", () => {
    expect(ids(filterReminders({ ...base, period: "manana" }))).toEqual(["B"]);
  });

  it("48h excluye las citas posteriores a la ventana de dos días", () => {
    expect(ids(filterReminders({ ...base, period: "48h" }))).toEqual(["A", "B", "C"]);
  });

  it("7dias incluye todas las citas con hora", () => {
    expect(ids(filterReminders({ ...base, period: "7dias" }))).toEqual(["A", "B", "C", "D"]);
  });

  it("filtra por profesional y por estado", () => {
    expect(ids(filterReminders({ ...base, period: "7dias", empId: "emp-9" }))).toEqual([]);
    expect(ids(filterReminders({ ...base, period: "7dias", empId: "emp-1", status: "confirmed" }))).toEqual(["B"]);
  });
});

describe("reminderRowState", () => {
  it("no permite confirmar hasta que haya un recordatorio enviado o copiado", () => {
    const row = reminderRowState(TODAY_PENDING, EMPTY_LOCAL, TODAY, TZ, false);
    expect(row.hasReminderContact).toBe(false);
    expect(row.canConfirm).toBe(false);
  });

  it("permite confirmar cuando hay contacto y la cita sigue agendada", () => {
    const local = { ...EMPTY_LOCAL, readyToConfirm: { A: true } };
    expect(reminderRowState(TODAY_PENDING, local, TODAY, TZ, false).canConfirm).toBe(true);
    expect(reminderRowState(TODAY_PENDING, local, TODAY, TZ, true).canConfirm).toBe(false);
  });

  it("usa el estado y el envío locales por encima de los del servidor", () => {
    const local = {
      ...EMPTY_LOCAL,
      manualStatus: { A: "confirmed" },
      manualSentAt: { A: "2026-06-12T16:00:00.000Z" },
    };
    const row = reminderRowState(TODAY_PENDING, local, TODAY, TZ, false);
    expect(row.currentStatus).toBe("confirmed");
    expect(row.canConfirm).toBe(false);
    expect(row.sentAt).toBe("2026-06-12T16:00:00.000Z");
    expect(row.sentToday).toBe(true);
  });

  it("indica si la cita tiene teléfono de contacto", () => {
    const noPhone = appt("F", { customer: { first_name: "Lucía", last_name: "Gómez", phone: null } });
    expect(reminderRowState(noPhone, EMPTY_LOCAL, TODAY, TZ, false).hasPhone).toBe(false);
    expect(reminderRowState(TODAY_PENDING, EMPTY_LOCAL, TODAY, TZ, false).hasPhone).toBe(true);
  });
});
