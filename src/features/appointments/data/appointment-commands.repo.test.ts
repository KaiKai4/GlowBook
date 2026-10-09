import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import {
  createAppointmentsSupabaseDouble,
  installSupabaseDouble,
  type AppointmentsSupabaseDouble,
} from "@/test/appointments-feature-supabase";
import {
  findAppointmentCreationResources,
  findAppointmentForCommand,
  findEmployeeExceptionDatesForCommand,
  findEmployeeOccupiedSlotsForCommand,
  findEmployeeWorkSchedulesForCommand,
  findOccupiedSlotsForSalonDate,
} from "./appointment-commands.repo";

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createSupabaseServerClient);

const salonId = "00000000-0000-4000-8000-0000000000k1";
const appointmentId = "00000000-0000-4000-8000-0000000000k2";
const customerId = "00000000-0000-4000-8000-0000000000k3";
const categoryId = "00000000-0000-4000-8000-0000000000k4";
const serviceA = "00000000-0000-4000-8000-0000000000k5";
const serviceB = "00000000-0000-4000-8000-0000000000k6";
const employeeA = "00000000-0000-4000-8000-0000000000k7";

function useDouble(double: AppointmentsSupabaseDouble): void {
  installSupabaseDouble(double, mockedCreateClient);
}

const failure = { message: "database rejected the query" };

describe("comandos de cita: cabecera y estado", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("busca la cita para comandos siempre por id y salón", async () => {
    const state = { id: appointmentId, status: "scheduled", salon_id: salonId, customer_id: customerId };
    const double = createAppointmentsSupabaseDouble({ appointments: { data: state, error: null } });
    useDouble(double);

    expect(await findAppointmentForCommand(appointmentId, salonId)).toEqual(state);
    expect(double.callsFor("appointments")).toEqual([
      { method: "select", args: ["id, status, salon_id, customer_id"] },
      { method: "eq", args: ["id", appointmentId] },
      { method: "eq", args: ["salon_id", salonId] },
      { method: "maybeSingle", args: [] },
    ]);
  });

  it("devuelve null si la cita no existe en el salón", async () => {
    useDouble(createAppointmentsSupabaseDouble({ appointments: { data: null, error: null } }));

    expect(await findAppointmentForCommand(appointmentId, salonId)).toBeNull();
  });

  it("propaga el error de lectura de la cita", async () => {
    useDouble(createAppointmentsSupabaseDouble({ appointments: { data: null, error: failure } }));

    await expect(findAppointmentForCommand(appointmentId, salonId)).rejects.toEqual(failure);
  });

});

describe("comandos de cita: recursos para crear o reprogramar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const salonRow = {
    min_booking_notice_minutes: 0,
    min_appointment_duration_minutes: 15,
    allow_off_hours_bookings: false,
    timezone: "America/Panama",
  };

  const businessHoursRows = [{ day_of_week: 1, is_open: true, open_time: "08:00", close_time: "18:00" }];

  function fullTables() {
    return {
      customers: { data: { id: customerId }, error: null },
      salons: { data: salonRow, error: null },
      salon_business_hours: { data: businessHoursRows, error: null },
      services: {
        data: [
          {
            id: serviceA,
            salon_id: salonId,
            duration_minutes: 30,
            price: "25.50",
            is_active: true,
            category_id: categoryId,
          },
        ],
        error: null,
      },
      employees: {
        data: [{ id: employeeA, salon_id: salonId, is_active: true, profile_id: null }],
        error: null,
      },
      employee_services: {
        data: [
          { employee_id: employeeA, service_id: serviceA },
          { employee_id: employeeA, service_id: serviceB },
        ],
        error: null,
      },
      employee_categories: { data: [{ employee_id: employeeA, category_id: categoryId }], error: null },
    };
  }

  it("arma servicios y profesionales con sus asociaciones y deja nulo lo que no existe", async () => {
    const double = createAppointmentsSupabaseDouble(fullTables());
    useDouble(double);

    const resources = await findAppointmentCreationResources({
      salonId,
      customerId,
      assignments: [
        { service_id: serviceA, employee_id: employeeA },
        { service_id: serviceB, employee_id: employeeA },
        { service_id: serviceA, employee_id: employeeA },
      ],
    });

    expect(resources.customerExists).toBe(true);
    expect(resources.salonConfig).toEqual(salonRow);
    expect(resources.businessHours).toEqual(businessHoursRows);
    expect(resources.assignments).toEqual([
      {
        service: {
          id: serviceA,
          duration_minutes: 30,
          price: 25.5,
          salon_id: salonId,
          is_active: true,
          category_id: categoryId,
        },
        employee: {
          id: employeeA,
          salon_id: salonId,
          is_active: true,
          profile_id: null,
          service_ids: [serviceA, serviceB],
          category_ids: [categoryId],
        },
      },
      {
        service: null,
        employee: expect.objectContaining({ id: employeeA }),
      },
      {
        service: expect.objectContaining({ id: serviceA }),
        employee: expect.objectContaining({ id: employeeA }),
      },
    ]);
  });

  it("consulta cada id solicitado una sola vez y siempre dentro del salón", async () => {
    const double = createAppointmentsSupabaseDouble(fullTables());
    useDouble(double);

    await findAppointmentCreationResources({
      salonId,
      customerId,
      assignments: [
        { service_id: serviceA, employee_id: employeeA },
        { service_id: serviceB, employee_id: employeeA },
        { service_id: serviceA, employee_id: employeeA },
      ],
    });

    expect(double.callsFor("services")).toContainEqual({ method: "in", args: ["id", [serviceA, serviceB]] });
    expect(double.callsFor("services")).toContainEqual({ method: "eq", args: ["salon_id", salonId] });
    expect(double.callsFor("employees")).toContainEqual({ method: "in", args: ["id", [employeeA]] });
    expect(double.callsFor("employees")).toContainEqual({ method: "eq", args: ["salon_id", salonId] });
    expect(double.callsFor("customers")).toContainEqual({ method: "eq", args: ["salon_id", salonId] });
    expect(double.callsFor("employee_services")).toContainEqual({
      method: "in",
      args: ["service_id", [serviceA, serviceB]],
    });
    expect(double.callsFor("employee_categories")).toContainEqual({ method: "eq", args: ["salon_id", salonId] });
  });

  it("cuando el cliente no existe no carga servicios de profesionales", async () => {
    const tables = fullTables();
    const double = createAppointmentsSupabaseDouble({
      ...tables,
      customers: { data: null, error: null },
    });
    useDouble(double);

    const resources = await findAppointmentCreationResources({
      salonId,
      customerId,
      assignments: [{ service_id: serviceA, employee_id: employeeA }],
    });

    expect(resources).toEqual({
      customerExists: false,
      salonConfig: salonRow,
      businessHours: businessHoursRows,
      assignments: [],
    });
    expect(double.callsFor("employee_services")).toEqual([]);
    expect(double.callsFor("employee_categories")).toEqual([]);
  });

  it("cuando el salón no existe devuelve configuración nula y sin asignaciones", async () => {
    useDouble(createAppointmentsSupabaseDouble({ ...fullTables(), salons: { data: null, error: null } }));

    const resources = await findAppointmentCreationResources({
      salonId,
      customerId,
      assignments: [{ service_id: serviceA, employee_id: employeeA }],
    });

    expect(resources).toMatchObject({ customerExists: true, salonConfig: null, assignments: [] });
  });

  it("sin horario de atención devuelve lista vacía de horas", async () => {
    useDouble(createAppointmentsSupabaseDouble({ ...fullTables(), salon_business_hours: { data: null, error: null } }));

    const resources = await findAppointmentCreationResources({
      salonId,
      customerId,
      assignments: [],
    });

    expect(resources.businessHours).toEqual([]);
  });

  it.each([
    ["cliente", "customers"],
    ["salón", "salons"],
    ["horario", "salon_business_hours"],
    ["servicios", "services"],
    ["profesionales", "employees"],
  ] as const)("propaga el error al consultar %s", async (_label, table) => {
    useDouble(createAppointmentsSupabaseDouble({ ...fullTables(), [table]: { data: null, error: failure } }));

    await expect(
      findAppointmentCreationResources({
        salonId,
        customerId,
        assignments: [{ service_id: serviceA, employee_id: employeeA }],
      })
    ).rejects.toEqual(failure);
  });

  it.each([
    ["servicios del profesional", "employee_services"],
    ["categorías del profesional", "employee_categories"],
  ] as const)("propaga el error al consultar %s", async (_label, table) => {
    useDouble(createAppointmentsSupabaseDouble({ ...fullTables(), [table]: { data: null, error: failure } }));

    await expect(
      findAppointmentCreationResources({
        salonId,
        customerId,
        assignments: [{ service_id: serviceA, employee_id: employeeA }],
      })
    ).rejects.toEqual(failure);
  });
});

describe("comandos de cita: disponibilidad del profesional", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lee solo los turnos activos del profesional", async () => {
    const double = createAppointmentsSupabaseDouble({
      work_schedules: {
        data: [{ day_of_week: 1, start_time: "08:00", end_time: "12:00", is_active: true }],
        error: null,
      },
    });
    useDouble(double);

    expect(await findEmployeeWorkSchedulesForCommand(employeeA)).toEqual([
      { day_of_week: 1, start_time: "08:00", end_time: "12:00", is_active: true },
    ]);
    expect(double.callsFor("work_schedules")).toEqual([
      { method: "select", args: ["day_of_week, start_time, end_time, is_active"] },
      { method: "eq", args: ["employee_id", employeeA] },
      { method: "eq", args: ["is_active", true] },
    ]);
  });

  it("sin turnos devuelve lista vacía y propaga errores", async () => {
    useDouble(createAppointmentsSupabaseDouble({ work_schedules: { data: null, error: null } }));
    expect(await findEmployeeWorkSchedulesForCommand(employeeA)).toEqual([]);

    useDouble(createAppointmentsSupabaseDouble({ work_schedules: { data: null, error: failure } }));
    await expect(findEmployeeWorkSchedulesForCommand(employeeA)).rejects.toEqual(failure);
  });

  describe("días libres", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-05-25T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("consulta desde un día antes de hoy para cubrir el desfase horario", async () => {
      const double = createAppointmentsSupabaseDouble({
        schedule_exceptions: {
          data: [{ exception_date: "2026-05-24" }, { exception_date: "2026-05-30" }],
          error: null,
        },
      });
      useDouble(double);

      expect(await findEmployeeExceptionDatesForCommand(employeeA)).toEqual(["2026-05-24", "2026-05-30"]);
      expect(double.callsFor("schedule_exceptions")).toEqual([
        { method: "select", args: ["exception_date"] },
        { method: "eq", args: ["employee_id", employeeA] },
        { method: "gte", args: ["exception_date", "2026-05-24"] },
      ]);
    });

    it("sin días libres devuelve lista vacía y propaga errores", async () => {
      useDouble(createAppointmentsSupabaseDouble({ schedule_exceptions: { data: null, error: null } }));
      expect(await findEmployeeExceptionDatesForCommand(employeeA)).toEqual([]);

      useDouble(createAppointmentsSupabaseDouble({ schedule_exceptions: { data: null, error: failure } }));
      await expect(findEmployeeExceptionDatesForCommand(employeeA)).rejects.toEqual(failure);
    });
  });

  it("consulta citas bloqueantes del profesional en el día local del salón, filtrando por salón", async () => {
    const double = createAppointmentsSupabaseDouble({ appointment_items: { data: [], error: null } });
    useDouble(double);

    await findEmployeeOccupiedSlotsForCommand({
      salonId,
      employeeId: employeeA,
      date: new Date("2026-05-25T15:00:00.000Z"),
      timezone: "America/Panama",
    });

    expect(double.callsFor("appointment_items")).toEqual([
      { method: "select", args: ["start_time, end_time"] },
      { method: "eq", args: ["salon_id", salonId] },
      { method: "eq", args: ["employee_id", employeeA] },
      { method: "eq", args: ["blocks_calendar", true] },
      { method: "gte", args: ["start_time", "2026-05-25T05:00:00.000Z"] },
      { method: "lte", args: ["start_time", "2026-05-26T04:59:59.999Z"] },
    ]);
  });

  it("excluye la propia cita cuando se reprograma", async () => {
    const double = createAppointmentsSupabaseDouble({ appointment_items: { data: [], error: null } });
    useDouble(double);

    await findEmployeeOccupiedSlotsForCommand({
      salonId,
      employeeId: employeeA,
      date: new Date("2026-05-25T15:00:00.000Z"),
      timezone: "America/Panama",
      excludeAppointmentId: appointmentId,
    });

    expect(double.callsFor("appointment_items")).toContainEqual({
      method: "neq",
      args: ["appointment_id", appointmentId],
    });
  });

  it("devuelve los bloques ocupados tal como llegan y propaga errores", async () => {
    const blocks = [{ start_time: "2026-05-25T15:00:00.000Z", end_time: "2026-05-25T15:30:00.000Z" }];
    useDouble(createAppointmentsSupabaseDouble({ appointment_items: { data: blocks, error: null } }));
    expect(
      await findEmployeeOccupiedSlotsForCommand({
        salonId,
        employeeId: employeeA,
        date: new Date("2026-05-25T15:00:00.000Z"),
        timezone: "America/Panama",
      })
    ).toEqual(blocks);

    useDouble(createAppointmentsSupabaseDouble({ appointment_items: { data: null, error: failure } }));
    await expect(
      findEmployeeOccupiedSlotsForCommand({
        salonId,
        employeeId: employeeA,
        date: new Date("2026-05-25T15:00:00.000Z"),
        timezone: "America/Panama",
      })
    ).rejects.toEqual(failure);
  });
});

describe("comandos de cita: agenda ocupada por día del salón", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const panamaItems = [
    { employee_id: "emp-1", start_time: "2026-05-25T15:00:00.000Z", end_time: "2026-05-25T15:30:00.000Z" },
    { employee_id: "emp-2", start_time: "2026-05-25T18:00:00.000Z", end_time: "2026-05-25T18:45:00.000Z" },
  ];

  it("agrupa bloques por profesional y agrega los días libres como bloque de día completo", async () => {
    const double = createAppointmentsSupabaseDouble({
      salons: { data: { timezone: "America/Panama" }, error: null },
      appointment_items: { data: panamaItems, error: null },
      schedule_exceptions: { data: [{ employee_id: "emp-2" }], error: null },
    });
    useDouble(double);

    const occupied = await findOccupiedSlotsForSalonDate(salonId, "2026-05-25");

    expect(occupied).toEqual({
      "emp-1": [{ start_time: "2026-05-25T15:00:00.000Z", end_time: "2026-05-25T15:30:00.000Z" }],
      "emp-2": [
        { start_time: "2026-05-25T18:00:00.000Z", end_time: "2026-05-25T18:45:00.000Z" },
        { start_time: "2026-05-25T05:00:00.000Z", end_time: "2026-05-26T04:59:59.999Z" },
      ],
    });
    expect(double.callsFor("appointment_items")).toEqual([
      { method: "select", args: ["employee_id, start_time, end_time"] },
      { method: "eq", args: ["salon_id", salonId] },
      { method: "eq", args: ["blocks_calendar", true] },
      { method: "gte", args: ["start_time", "2026-05-25T05:00:00.000Z"] },
      { method: "lte", args: ["start_time", "2026-05-26T04:59:59.999Z"] },
    ]);
    expect(double.callsFor("schedule_exceptions")).toEqual([
      { method: "select", args: ["employee_id"] },
      { method: "eq", args: ["salon_id", salonId] },
      { method: "eq", args: ["exception_date", "2026-05-25"] },
    ]);
  });

  it("usa el día local de la zona del salón aunque la fecha UTC sea distinta", async () => {
    const double = createAppointmentsSupabaseDouble({
      salons: { data: { timezone: "Pacific/Kiritimati" }, error: null },
      appointment_items: { data: [], error: null },
      schedule_exceptions: { data: [], error: null },
    });
    useDouble(double);

    await findOccupiedSlotsForSalonDate(salonId, "2026-05-25");

    expect(double.callsFor("appointment_items")).toEqual(
      expect.arrayContaining([
        { method: "gte", args: ["start_time", "2026-05-24T10:00:00.000Z"] },
        { method: "lte", args: ["start_time", "2026-05-25T09:59:59.999Z"] },
      ])
    );
  });

  it("propaga el error al leer la zona horaria del salón en vez de ignorarlo", async () => {
    useDouble(
      createAppointmentsSupabaseDouble({
        salons: { data: null, error: failure },
        appointment_items: { data: [], error: null },
        schedule_exceptions: { data: [], error: null },
      })
    );

    await expect(findOccupiedSlotsForSalonDate(salonId, "2026-05-25")).rejects.toEqual(failure);
  });

  it("sin zona horaria del salón usa UTC", async () => {
    const double = createAppointmentsSupabaseDouble({
      salons: { data: null, error: null },
      appointment_items: { data: [], error: null },
      schedule_exceptions: { data: [], error: null },
    });
    useDouble(double);

    await findOccupiedSlotsForSalonDate(salonId, "2026-05-25");

    expect(double.callsFor("appointment_items")).toEqual(
      expect.arrayContaining([
        { method: "gte", args: ["start_time", "2026-05-25T00:00:00.000Z"] },
        { method: "lte", args: ["start_time", "2026-05-25T23:59:59.999Z"] },
      ])
    );
  });

  it("excluye la cita que se reprograma de la agenda ocupada", async () => {
    const double = createAppointmentsSupabaseDouble({
      salons: { data: { timezone: "America/Panama" }, error: null },
      appointment_items: { data: [], error: null },
      schedule_exceptions: { data: [], error: null },
    });
    useDouble(double);

    await findOccupiedSlotsForSalonDate(salonId, "2026-05-25", appointmentId);

    expect(double.callsFor("appointment_items")).toContainEqual({
      method: "neq",
      args: ["appointment_id", appointmentId],
    });
  });

  it("CONDUCTA ACTUAL (posible bug): un error al leer la agenda se ignora y no hay bloques ocupados", async () => {
    const double = createAppointmentsSupabaseDouble({
      salons: { data: { timezone: "America/Panama" }, error: null },
      appointment_items: { data: null, error: failure },
      schedule_exceptions: { data: [], error: null },
    });
    useDouble(double);

    expect(await findOccupiedSlotsForSalonDate(salonId, "2026-05-25")).toEqual({});
  });
});
