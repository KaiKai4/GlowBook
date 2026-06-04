import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRemindableAppointments } from "@/features/appointments/use-cases/remindable-appointments";
import { getActiveEmployeeNameOptions } from "@/features/employees/use-cases/employee-name-options";
import { getActiveMessageTemplate } from "@/features/notifications/use-cases/active-message-template";
import { findLatestReminderLogsByAppointmentIds } from "@/features/reminders/data/reminder-log.repo";
import { getSalonIdentity } from "@/features/salon/use-cases/salon-identity";
import { getReminderQueue } from "./get-reminder-queue";

vi.mock("@/features/appointments/use-cases/remindable-appointments", () => ({
  getRemindableAppointments: vi.fn(),
}));

vi.mock("@/features/employees/use-cases/employee-name-options", () => ({
  getActiveEmployeeNameOptions: vi.fn(),
}));

vi.mock("@/features/notifications/use-cases/active-message-template", () => ({
  getActiveMessageTemplate: vi.fn(),
}));

vi.mock("@/features/reminders/data/reminder-log.repo", () => ({
  findLatestReminderLogsByAppointmentIds: vi.fn(),
}));

vi.mock("@/features/salon/use-cases/salon-identity", () => ({
  getSalonIdentity: vi.fn(),
}));

const mockedGetRemindableAppointments = vi.mocked(getRemindableAppointments);
const mockedGetActiveEmployeeNameOptions = vi.mocked(getActiveEmployeeNameOptions);
const mockedGetActiveMessageTemplate = vi.mocked(getActiveMessageTemplate);
const mockedFindLatestReminderLogsByAppointmentIds = vi.mocked(findLatestReminderLogsByAppointmentIds);
const mockedGetSalonIdentity = vi.mocked(getSalonIdentity);

function appointment(status: string) {
  return {
    id: `appt-${status}`,
    status,
    start_time: "2026-05-29T15:00:00.000Z",
    total_price: 35,
    customer: {
      id: "customer-1",
      first_name: "Lia",
      last_name: "Mora",
      phone: "+50760000000",
      email: null,
      is_temporary: false,
    },
    items: [
      {
        id: `item-${status}`,
        service_id: "service-1",
        employee_id: "employee-1",
        start_time: "2026-05-29T15:00:00.000Z",
        end_time: "2026-05-29T15:30:00.000Z",
        duration_minutes: 30,
        price: 35,
        discount_amount: 0,
        ordering: 0,
        service: {
          id: "service-1",
          name: "Corte",
          duration_minutes: 30,
          category: null,
        },
        employee: { id: "employee-1", first_name: "Ana", last_name: "Vega" },
      },
    ],
  };
}

describe("get reminder queue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetSalonIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "America/Panama",
    });
    mockedGetActiveMessageTemplate.mockResolvedValue({
      id: "template-1",
      bodyText: "Hola {cliente}, recuerda tu cita en {salon}.",
    });
    mockedFindLatestReminderLogsByAppointmentIds.mockResolvedValue(new Map());
    mockedGetActiveEmployeeNameOptions.mockResolvedValue([
      { id: "employee-1", name: "Ana Vega" },
    ]);
  });

  it("builds the reminder worklist from appointments, collaborators and template", async () => {
    mockedGetRemindableAppointments.mockResolvedValue([
      appointment("scheduled"),
      appointment("confirmed"),
    ]);

    const result = await getReminderQueue({
      salonId: "salon-1",
      now: new Date("2026-05-29T15:00:00.000Z"),
    });

    expect(mockedGetRemindableAppointments).toHaveBeenCalledWith("salon-1", {
      startDate: "2026-05-29T05:00:00.000Z",
      endDate: "2026-06-06T04:59:59.999Z",
    });
    expect(mockedGetActiveMessageTemplate).toHaveBeenCalledWith(
      "salon-1",
      "appointment_reminder"
    );
    expect(result).toMatchObject({
      timezone: "America/Panama",
      salonName: "Glow Studio",
      template: "Hola {cliente}, recuerda tu cita en {salon}.",
      templateId: "template-1",
      employees: [{ id: "employee-1", name: "Ana Vega" }],
    });
    expect(result.appointments.map((item) => item.status)).toEqual(["scheduled", "confirmed"]);
    expect(result.appointments[0]).toMatchObject({
      id: "appt-scheduled",
      customer: { first_name: "Lia", last_name: "Mora" },
      last_reminder_sent_at: null,
      items: [
        {
          service: { name: "Corte" },
          employee: { id: "employee-1", first_name: "Ana", last_name: "Vega" },
        },
      ],
    });
  });

  it("adds the latest manual reminder metadata to each appointment", async () => {
    mockedGetRemindableAppointments.mockResolvedValue([
      appointment("scheduled"),
    ]);
    mockedFindLatestReminderLogsByAppointmentIds.mockResolvedValue(new Map([
      ["appt-scheduled", {
        appointment_id: "appt-scheduled",
        sent_at: "2026-05-29T14:00:00.000Z",
        channel: "whatsapp",
      }],
    ]));

    const result = await getReminderQueue({
      salonId: "salon-1",
      now: new Date("2026-05-29T15:00:00.000Z"),
    });

    expect(mockedFindLatestReminderLogsByAppointmentIds).toHaveBeenCalledWith(
      "salon-1",
      ["appt-scheduled"]
    );
    expect(result.appointments[0]).toMatchObject({
      last_reminder_sent_at: "2026-05-29T14:00:00.000Z",
      last_reminder_channel: "whatsapp",
    });
  });

  it("falls back to Panama timezone and generic salon name when identity is missing", async () => {
    mockedGetSalonIdentity.mockResolvedValue(null);
    mockedGetRemindableAppointments.mockResolvedValue([]);

    const result = await getReminderQueue({
      salonId: "salon-1",
      daysAhead: 1,
      now: new Date("2026-05-29T04:30:00.000Z"),
    });

    expect(mockedGetRemindableAppointments).toHaveBeenCalledWith("salon-1", {
      startDate: "2026-05-28T05:00:00.000Z",
      endDate: "2026-05-30T04:59:59.999Z",
    });
    expect(result.salonName).toBe("tu salon");
    expect(result.timezone).toBe("America/Panama");
  });
});
