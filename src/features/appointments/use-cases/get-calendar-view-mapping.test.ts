import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEmployeeCalendarOptions } from "@/features/employees/use-cases/employee-calendar-options";
import { getActiveMessageTemplate } from "@/features/notifications/use-cases/active-message-template";
import { getSalonBusinessHours } from "@/features/salon/use-cases/salon-business-hours";
import { getSalonIdentity } from "@/features/salon/use-cases/salon-identity";
import { getSalonPaymentMethods } from "@/features/salon/use-cases/salon-payment-methods";
import { findAppointmentsBySalon, type AppointmentWithDetails } from "../data/appointments.repo";
import { getCalendarView } from "./get-calendar-view";

vi.mock("../data/appointments.repo", () => ({
  findAppointmentsBySalon: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-calendar-options", () => ({
  getEmployeeCalendarOptions: vi.fn(),
}));
vi.mock("@/features/notifications/use-cases/active-message-template", () => ({
  getActiveMessageTemplate: vi.fn(),
}));
vi.mock("@/features/salon/use-cases/salon-business-hours", () => ({
  getSalonBusinessHours: vi.fn(),
}));
vi.mock("@/features/salon/use-cases/salon-identity", () => ({
  getSalonIdentity: vi.fn(),
}));
vi.mock("@/features/salon/use-cases/salon-payment-methods", () => ({
  getSalonPaymentMethods: vi.fn(),
}));

const mockedFindAppointments = vi.mocked(findAppointmentsBySalon);
const mockedEmployees = vi.mocked(getEmployeeCalendarOptions);
const mockedTemplate = vi.mocked(getActiveMessageTemplate);
const mockedBusinessHours = vi.mocked(getSalonBusinessHours);
const mockedIdentity = vi.mocked(getSalonIdentity);
const mockedPaymentMethods = vi.mocked(getSalonPaymentMethods);

const SALON_ID = "00000000-0000-4000-8000-0000000000h1";
const WEDNESDAY = "2026-05-27";

/** Simula columnas numéricas nulas que llegan de la BD aunque el tipo generado no lo admita. */
function withNullFields<T extends object>(row: T, keys: string[]): T {
  return { ...row, ...Object.fromEntries(keys.map((key) => [key, null])) };
}

type Row = AppointmentWithDetails;

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "appointment-1",
    salon_id: SALON_ID,
    status: "scheduled",
    start_time: "2026-05-27T14:00:00.000Z",
    end_time: "2026-05-27T14:30:00.000Z",
    customer_id: "customer-1",
    created_by: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z",
    discount_amount: 0,
    total_price: 20,
    payment_method: "cash",
    completion_price_note: "",
    notes: "",
    customer: null,
    items: [],
    ...overrides,
  };
}

const openMondayToSaturday = [
  { day_of_week: 0, is_open: true, open_time: "08:00", close_time: "18:00" },
  { day_of_week: 1, is_open: true, open_time: "08:00", close_time: "18:00" },
  { day_of_week: 2, is_open: true, open_time: "08:00", close_time: "18:00" },
  { day_of_week: 3, is_open: true, open_time: "08:00", close_time: "18:00" },
  { day_of_week: 4, is_open: true, open_time: "08:00", close_time: "18:00" },
  { day_of_week: 5, is_open: true, open_time: "08:00", close_time: "18:00" },
  { day_of_week: 6, is_open: false, open_time: null, close_time: null },
];

describe("getCalendarView: mapeo de citas", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedIdentity.mockResolvedValue({ name: "Glow Studio", timezone: "America/Panama", payment_methods: [] });
    mockedBusinessHours.mockResolvedValue(openMondayToSaturday);
    mockedTemplate.mockResolvedValue({ bodyText: "Tu cita fue cancelada." });
    mockedPaymentMethods.mockResolvedValue({ enabled: ["cash"], options: [{ value: "cash", label: "Efectivo" }] });
    mockedEmployees.mockResolvedValue([]);
    mockedFindAppointments.mockResolvedValue([]);
  });

  it("un estado desconocido de la BD se muestra como agendada", async () => {
    mockedFindAppointments.mockResolvedValue([row({ status: "archivada" })]);

    const model = await getCalendarView({ salonId: SALON_ID, canViewAll: false, date: WEDNESDAY, view: "diaria" });

    expect(model.appointments[0]?.status).toBe("scheduled");
  });

  it("transforma el modo de precio desconocido en fijo y conserva el de la categoría variable", async () => {
    mockedFindAppointments.mockResolvedValue([
      row({
        items: [
          {
            id: "item-1",
            service_id: "service-1",
            employee_id: "employee-1",
            start_time: "2026-05-27T14:00:00.000Z",
            end_time: "2026-05-27T14:30:00.000Z",
            duration_minutes: 30,
            price: 20,
            discount_amount: 0,
            ordering: 1,
            service: {
              id: "service-1",
              name: "Corte",
              duration_minutes: 30,
              category: { id: "cat-1", name: "Cabello", pricing_mode: "modo-raro" },
            },
            employee: { id: "employee-1", first_name: "Ana", last_name: "Vega" },
          },
          {
            id: "item-2",
            service_id: "service-2",
            employee_id: "employee-1",
            start_time: "2026-05-27T14:30:00.000Z",
            end_time: "2026-05-27T15:30:00.000Z",
            duration_minutes: 60,
            price: 35,
            discount_amount: 0,
            ordering: 2,
            service: {
              id: "service-2",
              name: "Pedicura",
              duration_minutes: 60,
              category: { id: "cat-2", name: "Pies", pricing_mode: "variable" },
            },
            employee: null,
          },
        ],
      }),
    ]);

    const model = await getCalendarView({ salonId: SALON_ID, canViewAll: false, date: WEDNESDAY, view: "diaria" });

    expect(model.appointments[0]?.items.map((item) => item.service?.category?.pricing_mode)).toEqual([
      "fixed",
      "variable",
    ]);
    expect(model.appointments[0]?.items[1]?.employee).toBeNull();
  });

  it("conserva servicio y categoría nulos como nulos y convierte descuentos vacíos en cero", async () => {
    mockedFindAppointments.mockResolvedValue([
      row({
        items: [
          withNullFields(
            {
              id: "item-1",
              service_id: "service-x",
              employee_id: "employee-1",
              start_time: "2026-05-27T14:00:00.000Z",
              end_time: "2026-05-27T14:30:00.000Z",
              duration_minutes: 30,
              price: 20,
              discount_amount: 0,
              ordering: 1,
              service: null,
              employee: null,
            },
            ["discount_amount"]
          ),
          {
            id: "item-2",
            service_id: "service-y",
            employee_id: "employee-1",
            start_time: "2026-05-27T14:30:00.000Z",
            end_time: "2026-05-27T15:00:00.000Z",
            duration_minutes: 30,
            price: 10,
            discount_amount: 0,
            ordering: 2,
            service: { id: "service-y", name: "Limpieza", duration_minutes: 30, category: null },
            employee: null,
          },
        ],
      }),
    ]);

    const model = await getCalendarView({ salonId: SALON_ID, canViewAll: false, date: WEDNESDAY, view: "diaria" });

    expect(model.appointments[0]?.items[0]).toMatchObject({ service: null, discount_amount: 0 });
    expect(model.appointments[0]?.items[1]?.service).toEqual({
      id: "service-y",
      name: "Limpieza",
      duration_minutes: 30,
      category: null,
    });
  });

  it("cuenta como activas solo las citas agendadas o confirmadas del día en vista diaria", async () => {
    mockedFindAppointments.mockResolvedValue([
      row({ id: "a", status: "scheduled", start_time: "2026-05-26T14:00:00.000Z" }),
      row({ id: "b", status: "confirmed", start_time: "2026-05-27T14:00:00.000Z" }),
      row({ id: "c", status: "completed", start_time: "2026-05-27T15:00:00.000Z" }),
      row({ id: "d", status: "cancelled", start_time: "2026-05-27T16:00:00.000Z" }),
      row({ id: "e", status: "scheduled", start_time: "2026-05-31T14:00:00.000Z" }),
    ]);

    const model = await getCalendarView({ salonId: SALON_ID, canViewAll: false, date: WEDNESDAY, view: "diaria" });

    expect(model.appointments).toHaveLength(5);
    expect(model.activeCount).toBe(3);
  });

  it("en vista semanal solo cuenta las activas que caen en los días visibles", async () => {
    mockedFindAppointments.mockResolvedValue([
      row({ id: "a", status: "scheduled", start_time: "2026-05-26T14:00:00.000Z" }),
      row({ id: "b", status: "confirmed", start_time: "2026-05-27T14:00:00.000Z" }),
      row({ id: "c", status: "completed", start_time: "2026-05-27T15:00:00.000Z" }),
      row({ id: "e", status: "scheduled", start_time: "2026-05-31T14:00:00.000Z" }),
    ]);

    const model = await getCalendarView({ salonId: SALON_ID, canViewAll: false, date: WEDNESDAY, view: "semanal" });

    expect(model.view).toBe("semanal");
    expect(model.activeCount).toBe(2);
    expect(model.visibleWeekDates).toEqual([
      "2026-05-25",
      "2026-05-26",
      "2026-05-27",
      "2026-05-28",
      "2026-05-29",
      "2026-05-30",
    ]);
  });
});

describe("getCalendarView: vistas, zona y textos del salón", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedIdentity.mockResolvedValue({ name: "Glow Studio", timezone: "America/Panama", payment_methods: [] });
    mockedBusinessHours.mockResolvedValue(openMondayToSaturday);
    mockedTemplate.mockResolvedValue({ bodyText: "Tu cita fue cancelada." });
    mockedPaymentMethods.mockResolvedValue({ enabled: ["cash"], options: [{ value: "cash", label: "Efectivo" }] });
    mockedEmployees.mockResolvedValue([{ id: "emp-1", first_name: "Marta", last_name: "Ruiz" }]);
    mockedFindAppointments.mockResolvedValue([]);
  });

  it("sin permiso de vista general la vista por trabajador se degrada a semanal sin cargar colaboradores", async () => {
    const model = await getCalendarView({
      salonId: SALON_ID,
      canViewAll: false,
      date: WEDNESDAY,
      view: "trabajador",
    });

    expect(model).toMatchObject({ view: "semanal", showWorkerView: false, employees: [] });
    expect(mockedEmployees).not.toHaveBeenCalled();
  });

  it("con permiso de vista general la vista por trabajador carga los colaboradores del salón", async () => {
    const model = await getCalendarView({
      salonId: SALON_ID,
      canViewAll: true,
      date: WEDNESDAY,
      view: "trabajador",
    });

    expect(model).toMatchObject({
      view: "trabajador",
      showWorkerView: true,
      employees: [{ id: "emp-1", first_name: "Marta", last_name: "Ruiz" }],
    });
    expect(mockedEmployees).toHaveBeenCalledWith(SALON_ID);
  });

  it("una vista desconocida o ausente cae en semanal", async () => {
    const model = await getCalendarView({ salonId: SALON_ID, canViewAll: true, date: WEDNESDAY, view: "mensual" });

    expect(model.view).toBe("semanal");
  });

  it("consulta solo el día seleccionado en vista diaria con los límites UTC de la zona del salón", async () => {
    await getCalendarView({ salonId: SALON_ID, canViewAll: false, date: WEDNESDAY, view: "diaria" });

    expect(mockedFindAppointments).toHaveBeenCalledWith(SALON_ID, {
      startDate: "2026-05-27T05:00:00.000Z",
      endDate: "2026-05-28T04:59:59.999Z",
    });
  });

  it("sin identidad del salón usa la zona horaria y el nombre de respaldo", async () => {
    mockedIdentity.mockResolvedValue(null);

    const model = await getCalendarView({ salonId: SALON_ID, canViewAll: false, date: WEDNESDAY, view: "diaria" });

    expect(model).toMatchObject({ timezone: "America/Panama", salonName: "tu salon" });
  });

  it("usa la zona horaria del salón para la fecha inicial cuando no se indica fecha", async () => {
    mockedIdentity.mockResolvedValue({ name: "Glow", timezone: "Pacific/Kiritimati", payment_methods: [] });

    // 2026-05-27T23:30Z es 2026-05-28 en Kiritimati (UTC+14).
    const model = await getCalendarView({
      salonId: SALON_ID,
      canViewAll: false,
      view: "diaria",
      now: new Date("2026-05-27T23:30:00.000Z"),
    });

    expect(model.date).toBe("2026-05-28");
  });

  it("expone el texto de cancelación activo y las opciones de pago del salón", async () => {
    const model = await getCalendarView({ salonId: SALON_ID, canViewAll: false, date: WEDNESDAY, view: "diaria" });

    expect(model.cancellationTemplate).toBe("Tu cita fue cancelada.");
    expect(model.paymentMethodOptions).toEqual([{ value: "cash", label: "Efectivo" }]);
    expect(model.businessStart).toBe(8);
    expect(model.businessEnd).toBe(18);
    expect(mockedTemplate).toHaveBeenCalledWith(SALON_ID, "appointment_cancelled");
  });
});
