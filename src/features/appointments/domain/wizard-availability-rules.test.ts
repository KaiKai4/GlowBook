import { describe, expect, it } from "vitest";
import {
  buildSequentialSchedule,
  createAppointmentRow,
  findEligibleEmployees,
  salonWindowFor,
  type AppointmentServiceRow,
  type OccupiedByEmployee,
  type WizardEmployeeOption,
  type WizardServiceOption,
} from "./wizard-availability";
import type { BusinessHour, SalonConfig } from "./types";

// 2026-05-28 es jueves (day_of_week 3). Panamá es UTC-5 sin horario de verano.
const THURSDAY = "2026-05-28";

const salonConfig: SalonConfig = {
  timezone: "America/Panama",
  allow_off_hours_bookings: false,
  min_booking_notice_minutes: 0,
  min_appointment_duration_minutes: 15,
};

const businessHours: BusinessHour[] = [
  { day_of_week: 3, is_open: true, open_time: "10:00:00", close_time: "17:00:00" },
  { day_of_week: 4, is_open: false, open_time: null, close_time: null },
];

const haircut: WizardServiceOption = {
  id: "svc-cut",
  name: "Corte",
  category_id: "cat-hair",
  duration_minutes: 30,
  price: 20,
};

const manicure: WizardServiceOption = {
  id: "svc-nails",
  name: "Manicura",
  category_id: "cat-nails",
  duration_minutes: 45,
  price: 15,
};

const serviceMap = new Map<string, WizardServiceOption>([
  [haircut.id, haircut],
  [manicure.id, manicure],
]);

function employee(overrides: Partial<WizardEmployeeOption> = {}): WizardEmployeeOption {
  return {
    id: "emp-1",
    service_ids: [haircut.id],
    category_ids: [haircut.category_id],
    work_schedules: [
      { day_of_week: 3, is_active: true, start_time: "09:00", end_time: "15:00" },
    ],
    ...overrides,
  };
}

describe("wizard de citas: ventana del salón", () => {
  it("no hay ventana sin fecha seleccionada", () => {
    expect(salonWindowFor("", salonConfig.timezone, businessHours)).toBeNull();
  });

  it("devuelve la apertura y el cierre en HH:mm para un día abierto", () => {
    expect(salonWindowFor(THURSDAY, salonConfig.timezone, businessHours)).toEqual({
      open: "10:00",
      close: "17:00",
    });
  });

  it("no hay ventana para un día cerrado", () => {
    expect(salonWindowFor("2026-05-29", salonConfig.timezone, businessHours)).toBeNull();
  });

  it("no hay ventana para un día sin fila de horario", () => {
    expect(salonWindowFor("2026-05-25", salonConfig.timezone, [])).toBeNull();
  });

  it("no hay ventana cuando el día abierto no tiene horas completas", () => {
    const partial: BusinessHour[] = [
      { day_of_week: 3, is_open: true, open_time: "10:00", close_time: null },
    ];

    expect(salonWindowFor(THURSDAY, salonConfig.timezone, partial)).toBeNull();
  });
});

describe("wizard de citas: cronograma secuencial", () => {
  it("sin fecha no hay cronograma", () => {
    const rows = [createAppointmentRow(1)];

    expect(
      buildSequentialSchedule({ rows, date: "", time: "10:00", timeZone: "America/Panama", serviceMap })
    ).toEqual([]);
  });

  it("encadena cada servicio desde el fin del anterior", () => {
    const rows: AppointmentServiceRow[] = [
      { key: "r1", categoryId: "cat-hair", serviceId: haircut.id, employeeId: "" },
      { key: "r2", categoryId: "cat-nails", serviceId: manicure.id, employeeId: "" },
    ];

    const schedule = buildSequentialSchedule({ rows, date: THURSDAY, time: "10:00", timeZone: "America/Panama", serviceMap });

    expect(schedule.map((item) => item.row.key)).toEqual(["r1", "r2"]);
    expect(schedule[0]?.service).toBe(haircut);
    expect(schedule[1]?.service).toBe(manicure);
    expect(schedule[1]?.start).toBe(schedule[0]?.end);
    const firstMinutes = ((schedule[0]?.end?.getTime() ?? 0) - (schedule[0]?.start?.getTime() ?? 0)) / 60_000;
    const secondMinutes = ((schedule[1]?.end?.getTime() ?? 0) - (schedule[1]?.start?.getTime() ?? 0)) / 60_000;
    expect(firstMinutes).toBe(30);
    expect(secondMinutes).toBe(45);
  });

  it("una fila con servicio desconocido conserva inicio y deja fin igual al inicio", () => {
    const rows: AppointmentServiceRow[] = [
      { key: "r1", categoryId: "", serviceId: "svc-desconocido", employeeId: "" },
      { key: "r2", categoryId: "cat-hair", serviceId: haircut.id, employeeId: "" },
    ];

    const schedule = buildSequentialSchedule({ rows, date: THURSDAY, time: "10:00", timeZone: "America/Panama", serviceMap });

    expect(schedule[0]?.service).toBeUndefined();
    expect(schedule[0]?.start).toBe(schedule[0]?.end);
    expect(schedule[1]?.start).toBe(schedule[0]?.end);
  });

  it("createAppointmentRow crea una fila vacía con clave estable por número", () => {
    expect(createAppointmentRow(3)).toEqual({
      key: "r3",
      categoryId: "",
      serviceId: "",
      employeeId: "",
    });
  });
});

describe("wizard de citas: colaboradores elegibles", () => {
  it("no devuelve colaboradores para un servicio desconocido", () => {
    expect(
      findEligibleEmployees({
        serviceId: "svc-desconocido",
        start: null,
        end: null,
        employees: [employee()],
        serviceMap,
        salonConfig,
        businessHours,
        occupied: {},
      })
    ).toEqual([]);
  });

  it("sin horario seleccionado devuelve quien hace el servicio y la categoría", () => {
    const qualified = employee({ id: "emp-ok" });
    const wrongCategory = employee({ id: "emp-cat", category_ids: ["cat-nails"] });
    const wrongService = employee({ id: "emp-svc", service_ids: [manicure.id] });

    const eligible = findEligibleEmployees({
      serviceId: haircut.id,
      start: null,
      end: null,
      employees: [qualified, wrongCategory, wrongService],
      serviceMap,
      salonConfig,
      businessHours,
      occupied: {},
    });

    expect(eligible.map((item) => item.id)).toEqual(["emp-ok"]);
  });

  it("con horario seleccionado descarta colaboradores fuera de su turno o con cita", () => {
    const start = new Date("2026-05-28T10:00:00-05:00");
    const end = new Date("2026-05-28T10:30:00-05:00");
    const occupied: OccupiedByEmployee = {
      "emp-busy": [
        {
          start_time: "2026-05-28T15:15:00.000Z",
          end_time: "2026-05-28T15:45:00.000Z",
        },
      ],
    };
    const early = employee({
      id: "emp-late-shift",
      work_schedules: [{ day_of_week: 3, is_active: true, start_time: "11:00", end_time: "15:00" }],
    });

    const eligible = findEligibleEmployees({
      serviceId: haircut.id,
      start,
      end,
      employees: [employee({ id: "emp-free" }), employee({ id: "emp-busy" }), early],
      serviceMap,
      salonConfig,
      businessHours,
      occupied,
    });

    expect(eligible.map((item) => item.id)).toEqual(["emp-free"]);
  });

  it("no aplica la duración mínima del salón al filtrar colaboradores", () => {
    const start = new Date("2026-05-28T10:00:00-05:00");
    const end = new Date("2026-05-28T10:05:00-05:00");

    const eligible = findEligibleEmployees({
      serviceId: haircut.id,
      start,
      end,
      employees: [employee()],
      serviceMap,
      salonConfig: { ...salonConfig, min_appointment_duration_minutes: 60 },
      businessHours,
      occupied: {},
    });

    expect(eligible).toHaveLength(1);
  });

  it("descarta colaboradores cuando la reserva termina después del cierre del salón", () => {
    const start = new Date("2026-05-28T16:45:00-05:00");
    const end = new Date("2026-05-28T17:15:00-05:00");

    const eligible = findEligibleEmployees({
      serviceId: haircut.id,
      start,
      end,
      employees: [employee({ work_schedules: [{ day_of_week: 3, is_active: true, start_time: "09:00", end_time: "23:00" }] })],
      serviceMap,
      salonConfig,
      businessHours,
      occupied: {},
    });

    expect(eligible).toEqual([]);
  });
});
