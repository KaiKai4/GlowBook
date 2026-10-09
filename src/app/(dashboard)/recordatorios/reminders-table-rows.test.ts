import { describe, expect, it } from "vitest";
import type { ReminderAppointment } from "@/features/reminders/view-models";
import { toReminderTableRows } from "./reminders-table-rows";

const TZ = "America/Panama";
const TODAY = "2026-06-12";
const NOTHING_LOCAL = { manualSentAt: {}, manualStatus: {}, readyToConfirm: {} };
const IDLE = { isPending: false, sendingId: null, confirmingId: null };

function appointment(overrides: Partial<ReminderAppointment> = {}): ReminderAppointment {
  return {
    id: "appt-1",
    status: "scheduled",
    start_time: "2026-06-12T15:00:00.000Z",
    total_price: 25,
    last_reminder_sent_at: null,
    last_reminder_channel: null,
    customer: { first_name: "Lucía", last_name: "Gómez", phone: "+507 6000-1234" },
    items: [],
    ...overrides,
  };
}

describe("toReminderTableRows", () => {
  it("mantiene el orden de las citas y deriva el estado de cada una", () => {
    const rows = toReminderTableRows(
      [appointment({ id: "a" }), appointment({ id: "b", last_reminder_sent_at: "2026-06-12T13:00:00.000Z" })],
      NOTHING_LOCAL,
      IDLE,
      TODAY,
      TZ
    );

    expect(rows.map((row) => row.appt.id)).toEqual(["a", "b"]);
    expect(rows[0]?.state.sentAt).toBeNull();
    expect(rows[1]?.state.sentToday).toBe(true);
  });

  it("aplica el envío manual y el estado confirmado locales sobre los datos del servidor", () => {
    const [row] = toReminderTableRows(
      [appointment()],
      {
        manualSentAt: { "appt-1": "2026-06-12T14:00:00.000Z" },
        manualStatus: { "appt-1": "confirmed" },
        readyToConfirm: {},
      },
      IDLE,
      TODAY,
      TZ
    );

    expect(row?.state.sentToday).toBe(true);
    expect(row?.state.currentStatus).toBe("confirmed");
    expect(row?.state.canConfirm).toBe(false);
  });

  it("marca solo la fila cuya confirmación o envío está en curso", () => {
    const rows = toReminderTableRows(
      [appointment({ id: "a" }), appointment({ id: "b" })],
      { ...NOTHING_LOCAL, readyToConfirm: { a: true, b: true } },
      { isPending: true, sendingId: "b", confirmingId: "a" },
      TODAY,
      TZ
    );

    expect(rows[0]).toMatchObject({ confirmBusy: true, sendBusy: false });
    expect(rows[1]).toMatchObject({ confirmBusy: false, sendBusy: true });
    expect(rows[0]?.state.canConfirm).toBe(false);
  });

  it("no marca operaciones en curso cuando la transición no está pendiente", () => {
    const [row] = toReminderTableRows(
      [appointment({ id: "a" })],
      NOTHING_LOCAL,
      { isPending: false, sendingId: "a", confirmingId: "a" },
      TODAY,
      TZ
    );

    expect(row).toMatchObject({ confirmBusy: false, sendBusy: false });
  });

  it("devuelve una lista vacía cuando no hay citas", () => {
    expect(toReminderTableRows([], NOTHING_LOCAL, IDLE, TODAY, TZ)).toEqual([]);
  });
});
