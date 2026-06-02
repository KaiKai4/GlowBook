import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAppointmentsBySalon } from "@/features/appointments/data/appointments.repo";
import { findActiveEmployeeNames } from "@/features/employees/data/employees.repo";
import { findActiveMessageTemplate } from "@/features/notifications/data/notification-templates.repo";
import { findLatestReminderLogsByAppointmentIds } from "@/features/reminders/data/reminder-log.repo";
import { findSalonIdentity } from "@/features/salon/data/salon.repo";
import { getReminderQueue } from "./get-reminder-queue";

vi.mock("@/features/appointments/data/appointments.repo", () => ({
  findAppointmentsBySalon: vi.fn(),
}));

vi.mock("@/features/employees/data/employees.repo", () => ({
  findActiveEmployeeNames: vi.fn(),
}));

vi.mock("@/features/notifications/data/notification-templates.repo", () => ({
  findActiveMessageTemplate: vi.fn(),
}));

vi.mock("@/features/reminders/data/reminder-log.repo", () => ({
  findLatestReminderLogsByAppointmentIds: vi.fn(),
}));

vi.mock("@/features/salon/data/salon.repo", () => ({
  findSalonIdentity: vi.fn(),
}));

const mockedFindAppointmentsBySalon = vi.mocked(findAppointmentsBySalon);
const mockedFindActiveEmployeeNames = vi.mocked(findActiveEmployeeNames);
const mockedFindActiveMessageTemplate = vi.mocked(findActiveMessageTemplate);
const mockedFindLatestReminderLogsByAppointmentIds = vi.mocked(findLatestReminderLogsByAppointmentIds);
const mockedFindSalonIdentity = vi.mocked(findSalonIdentity);

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
        ordering: 0,
        service: { id: "service-1", name: "Corte", duration_minutes: 30 },
        employee: { id: "employee-1", first_name: "Ana", last_name: "Vega" },
      },
    ],
  };
}

describe("get reminder queue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindSalonIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "America/Panama",
    });
    mockedFindActiveMessageTemplate.mockResolvedValue({
      id: "template-1",
      body_text: "Hola {cliente}, recuerda tu cita en {salon}.",
    } as never);
    mockedFindLatestReminderLogsByAppointmentIds.mockResolvedValue(new Map());
    mockedFindActiveEmployeeNames.mockResolvedValue([
      { id: "employee-1", first_name: "Ana", last_name: "Vega" },
    ] as never);
  });

  it("builds the reminder worklist from appointments, collaborators and template", async () => {
    mockedFindAppointmentsBySalon.mockResolvedValue([
      appointment("scheduled"),
      appointment("confirmed"),
      appointment("completed"),
      appointment("cancelled"),
      appointment("no_show"),
    ] as never);

    const result = await getReminderQueue({
      salonId: "salon-1",
      now: new Date("2026-05-29T15:00:00.000Z"),
    });

    expect(mockedFindAppointmentsBySalon).toHaveBeenCalledWith("salon-1", {
      startDate: "2026-05-29T05:00:00.000Z",
      endDate: "2026-06-06T04:59:59.999Z",
    });
    expect(mockedFindActiveMessageTemplate).toHaveBeenCalledWith(
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
    mockedFindAppointmentsBySalon.mockResolvedValue([
      appointment("scheduled"),
    ] as never);
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
    mockedFindSalonIdentity.mockResolvedValue(null);
    mockedFindAppointmentsBySalon.mockResolvedValue([] as never);

    const result = await getReminderQueue({
      salonId: "salon-1",
      daysAhead: 1,
      now: new Date("2026-05-29T04:30:00.000Z"),
    });

    expect(mockedFindAppointmentsBySalon).toHaveBeenCalledWith("salon-1", {
      startDate: "2026-05-28T05:00:00.000Z",
      endDate: "2026-05-30T04:59:59.999Z",
    });
    expect(result.salonName).toBe("tu salon");
    expect(result.timezone).toBe("America/Panama");
  });
});
