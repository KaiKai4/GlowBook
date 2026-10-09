import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { buildItemPayloads, type SchedulingContext } from "./scheduling";
import type { SalonConfig, ServiceAssignment } from "./types";

const salonId = "salon-1";

const salonConfig: SalonConfig = {
  timezone: "America/Panama",
  allow_off_hours_bookings: false,
  min_booking_notice_minutes: 0,
  min_appointment_duration_minutes: 15,
};

// 2026-05-25 es lunes. 09:00 en Panamá son las 14:00 UTC.
const mondayNineAm = new Date("2026-05-25T14:00:00.000Z");

function assignment(
  overrides: { service?: Partial<ServiceAssignment["service"]>; employee?: Partial<ServiceAssignment["employee"]> } = {}
): ServiceAssignment {
  const service: ServiceAssignment["service"] = {
    id: "service-1",
    duration_minutes: 30,
    price: 25,
    salon_id: salonId,
    is_active: true,
    category_id: "category-1",
    ...overrides.service,
  };
  return {
    service,
    employee: {
      id: "employee-1",
      salon_id: salonId,
      is_active: true,
      profile_id: null,
      service_ids: [service.id],
      category_ids: [service.category_id],
      ...overrides.employee,
    },
  };
}

function context(overrides: Partial<SchedulingContext> = {}): SchedulingContext {
  return {
    salonConfig,
    businessHours: [{ day_of_week: 0, is_open: true, open_time: "08:00", close_time: "18:00" }],
    getWorkSchedules: () => [
      { day_of_week: 0, is_active: true, start_time: "00:00", end_time: "23:59" },
    ],
    getOccupiedSlots: () => [],
    ...overrides,
  };
}

describe("buildItemPayloads: validación de asignaciones", () => {
  it("exige al menos un servicio", () => {
    expect(() => buildItemPayloads(salonId, mondayNineAm, [], context())).toThrow(
      "Selecciona al menos un servicio."
    );
  });

  it("rechaza un servicio de otro salón", () => {
    expect(() =>
      buildItemPayloads(
        salonId,
        mondayNineAm,
        [assignment({ service: { salon_id: "salon-2" } })],
        context()
      )
    ).toThrow("El servicio no pertenece al salón.");
  });

  it("rechaza un servicio inactivo", () => {
    expect(() =>
      buildItemPayloads(
        salonId,
        mondayNineAm,
        [assignment({ service: { is_active: false } })],
        context()
      )
    ).toThrow("El servicio no está activo.");
  });

  it("rechaza un profesional de otro salón", () => {
    expect(() =>
      buildItemPayloads(
        salonId,
        mondayNineAm,
        [assignment({ employee: { salon_id: "salon-2" } })],
        context()
      )
    ).toThrow("El profesional no pertenece al salón.");
  });

  it("rechaza un profesional inactivo", () => {
    expect(() =>
      buildItemPayloads(
        salonId,
        mondayNineAm,
        [assignment({ employee: { is_active: false } })],
        context()
      )
    ).toThrow("El profesional no está activo.");
  });

  it("rechaza un profesional que no atiende la categoría del servicio", () => {
    expect(() =>
      buildItemPayloads(
        salonId,
        mondayNineAm,
        [assignment({ employee: { category_ids: ["category-2"] } })],
        context()
      )
    ).toThrow("El profesional seleccionado no atiende esa categoría.");
  });

  it("valida el servicio antes que el horario: no consulta la agenda si la asignación es inválida", () => {
    const getOccupiedSlots = vi.fn(() => []);
    expect(() =>
      buildItemPayloads(
        salonId,
        mondayNineAm,
        [assignment({ service: { is_active: false } })],
        context({ getOccupiedSlots })
      )
    ).toThrow("El servicio no está activo.");
    expect(getOccupiedSlots).not.toHaveBeenCalled();
  });

  it("rechaza un día libre puntual del profesional usando las fechas que entrega el contexto", () => {
    const getExceptionDates = vi.fn(() => ["2026-05-25"]);

    expect(() =>
      buildItemPayloads(
        salonId,
        mondayNineAm,
        [assignment()],
        context({ getExceptionDates })
      )
    ).toThrow("El profesional tiene el día libre en esa fecha.");
    expect(getExceptionDates).toHaveBeenCalledWith("employee-1");
  });

  it("acepta la reserva si no hay fechas de excepción en el contexto", () => {
    const items = buildItemPayloads(salonId, mondayNineAm, [assignment()], context());

    expect(items).toHaveLength(1);
  });
});

describe("buildItemPayloads: cursor secuencial", () => {
  it("consulta turnos y agenda por profesional y por el inicio de cada item", () => {
    const getWorkSchedules = vi.fn(() => [
      { day_of_week: 0, is_active: true, start_time: "00:00", end_time: "23:59" },
    ]);
    const getOccupiedSlots = vi.fn(() => []);

    buildItemPayloads(
      salonId,
      mondayNineAm,
      [assignment(), assignment({ service: { id: "service-1", duration_minutes: 45 } })],
      context({ getWorkSchedules, getOccupiedSlots })
    );

    expect(getWorkSchedules).toHaveBeenCalledWith("employee-1");
    expect(getOccupiedSlots).toHaveBeenNthCalledWith(1, "employee-1", mondayNineAm);
    expect(getOccupiedSlots).toHaveBeenNthCalledWith(
      2,
      "employee-1",
      new Date("2026-05-25T14:30:00.000Z")
    );
  });

  it("asigna el orden 1..N y copia precio, duración y profesional de cada asignación", () => {
    const items = buildItemPayloads(
      salonId,
      mondayNineAm,
      [
        assignment({ service: { id: "service-a", duration_minutes: 20, price: 10 } }),
        assignment({
          service: { id: "service-b", duration_minutes: 40, price: 35 },
          employee: { id: "employee-2" },
        }),
      ],
      context({ getWorkSchedules: () => [{ day_of_week: 0, is_active: true, start_time: "00:00", end_time: "23:59" }] })
    );

    expect(items.map((item) => [item.service_id, item.employee_id, item.price, item.ordering])).toEqual([
      ["service-a", "employee-1", 10, 1],
      ["service-b", "employee-2", 35, 2],
    ]);
  });

  it("propiedad: los items quedan contiguos, empiezan en la hora pedida y suman las duraciones", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 15, max: 60 }), { minLength: 1, maxLength: 5 }),
        (durations) => {
          const assignments = durations.map((duration, index) =>
            assignment({ service: { id: `service-${index}`, duration_minutes: duration } })
          );

          const items = buildItemPayloads(salonId, mondayNineAm, assignments, context());

          expect(items[0]?.start_time.getTime()).toBe(mondayNineAm.getTime());
          items.forEach((item, index) => {
            expect(item.ordering).toBe(index + 1);
            expect(item.end_time.getTime() - item.start_time.getTime()).toBe(item.duration_minutes * 60_000);
            if (index > 0) {
              expect(item.start_time.getTime()).toBe(items[index - 1]?.end_time.getTime());
            }
          });
          const totalMinutes = durations.reduce((sum, value) => sum + value, 0);
          expect(items.at(-1)?.end_time.getTime()).toBe(mondayNineAm.getTime() + totalMinutes * 60_000);
        }
      )
    );
  });
});
