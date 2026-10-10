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

const mockedGetRemindable = vi.mocked(getRemindableAppointments);
const mockedGetTemplate = vi.mocked(getActiveMessageTemplate);
const mockedFindLatest = vi.mocked(findLatestReminderLogsByAppointmentIds);
const mockedGetEmployees = vi.mocked(getActiveEmployeeNameOptions);
const mockedGetSalon = vi.mocked(getSalonIdentity);

type RemindableRow = Awaited<ReturnType<typeof getRemindableAppointments>>[number];

function remindable(overrides: Record<string, unknown>): RemindableRow {
  return {
    id: "appt-1",
    status: "scheduled",
    start_time: "2026-06-13T15:00:00.000Z",
    total_price: 20,
    customer: null,
    items: [],
    ...overrides,
  } as RemindableRow;
}

describe("getReminderQueue (ramas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSalon.mockResolvedValue(null);
    mockedGetTemplate.mockResolvedValue({ id: "tpl-1", bodyText: "Hola" } as Awaited<ReturnType<typeof getActiveMessageTemplate>>);
    mockedGetEmployees.mockResolvedValue([]);
    mockedFindLatest.mockResolvedValue(new Map());
  });

  it("usa la zona horaria de Panama y el nombre de respaldo cuando el salón no existe", async () => {
    mockedGetRemindable.mockResolvedValue([]);

    const result = await getReminderQueue({ salonId: "salon-1", now: new Date("2026-06-12T12:00:00.000Z") });

    expect(result).toMatchObject({ timezone: "America/Panama", salonName: "tu salón", appointments: [] });
    expect(mockedGetRemindable).toHaveBeenCalledWith("salon-1", {
      startDate: "2026-06-12T05:00:00.000Z",
      endDate: "2026-06-20T04:59:59.999Z",
    });
  });

  it("amplia la ventana segun los días indicados", async () => {
    mockedGetRemindable.mockResolvedValue([]);

    await getReminderQueue({ salonId: "salon-1", daysAhead: 2, now: new Date("2026-06-12T12:00:00.000Z") });

    expect(mockedGetRemindable).toHaveBeenCalledWith("salon-1", {
      startDate: "2026-06-12T05:00:00.000Z",
      endDate: "2026-06-15T04:59:59.999Z",
    });
  });

  it("adjunta el último recordatorio por cita y deja nulos los que no tienen envio", async () => {
    mockedGetRemindable.mockResolvedValue([
      remindable({ id: "con-envio" }),
      remindable({ id: "sin-envio" }),
    ]);
    mockedFindLatest.mockResolvedValue(
      new Map([
        ["con-envio", { appointment_id: "con-envio", sent_at: "2026-06-11T09:00:00.000Z", channel: "whatsapp" }],
      ])
    );

    const result = await getReminderQueue({ salonId: "salon-1", now: new Date("2026-06-12T12:00:00.000Z") });

    expect(mockedFindLatest).toHaveBeenCalledWith("salon-1", ["con-envio", "sin-envio"]);
    expect(result.appointments[0]).toMatchObject({
      last_reminder_sent_at: "2026-06-11T09:00:00.000Z",
      last_reminder_channel: "whatsapp",
    });
    expect(result.appointments[1]).toMatchObject({
      last_reminder_sent_at: null,
      last_reminder_channel: null,
    });
  });

  it("deja cliente, servicio y colaborador en nulo cuando la cita no los tiene", async () => {
    mockedGetRemindable.mockResolvedValue([
      remindable({
        customer: null,
        items: [
          { id: "item-1", service: null, employee: null },
          { id: "item-2", service: { id: "s", name: "Peinado" }, employee: null },
        ],
      }),
    ]);

    const [appointment] = (await getReminderQueue({
      salonId: "salon-1",
      now: new Date("2026-06-12T12:00:00.000Z"),
    })).appointments;

    expect(appointment?.customer).toBeNull();
    expect(appointment?.items).toEqual([
      { id: "item-1", service: null, employee: null },
      { id: "item-2", service: { name: "Peinado" }, employee: null },
    ]);
  });

  it("expone la plantilla activa y los colaboradores del salón", async () => {
    mockedGetRemindable.mockResolvedValue([]);
    mockedGetEmployees.mockResolvedValue([{ id: "e1", name: "Ana Vega" }]);

    const result = await getReminderQueue({ salonId: "salon-1", now: new Date("2026-06-12T12:00:00.000Z") });

    expect(mockedGetTemplate).toHaveBeenCalledWith("salon-1", "appointment_reminder");
    expect(result).toMatchObject({ template: "Hola", templateId: "tpl-1", employees: [{ id: "e1", name: "Ana Vega" }] });
    expect(mockedGetEmployees).toHaveBeenCalledWith("salon-1");
  });
});
