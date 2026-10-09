import { describe, expect, it } from "vitest";
import { PublicError } from "@/infra/public-error";
import { assertTransition } from "./lifecycle";
import { buildItemPayloads, type SchedulingContext } from "./scheduling";
import type { ServiceAssignment } from "./types";

const SALON = "00000000-0000-4000-8000-000000000001";
const OTHER_SALON = "00000000-0000-4000-8000-0000000000ff";
const START = new Date("2026-06-01T15:00:00.000Z");

function assignment(overrides: {
  service?: Partial<ServiceAssignment["service"]>;
  employee?: Partial<ServiceAssignment["employee"]>;
} = {}): ServiceAssignment {
  return {
    service: {
      id: "service-1",
      duration_minutes: 30,
      price: 100,
      salon_id: SALON,
      is_active: true,
      category_id: "cat-1",
      ...overrides.service,
    },
    employee: {
      id: "emp-1",
      salon_id: SALON,
      is_active: true,
      profile_id: null,
      service_ids: ["service-1"],
      category_ids: ["cat-1"],
      ...overrides.employee,
    },
  };
}

// Contexto sin horario laboral: cualquier rango queda fuera del horario del profesional.
const context: SchedulingContext = {
  salonConfig: {
    min_booking_notice_minutes: 0,
    min_appointment_duration_minutes: 15,
    allow_off_hours_bookings: false,
    timezone: "UTC",
  },
  businessHours: [],
  getWorkSchedules: () => [],
  getOccupiedSlots: () => [],
};

function errorOf(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("transiciones de cita (assertTransition)", () => {
  it("permite la transicion valida sin lanzar", () => {
    expect(() => assertTransition("scheduled", "confirmed")).not.toThrow();
  });

  it("una transicion no permitida lanza PublicError con el estado de origen y destino", () => {
    const error = errorOf(() => assertTransition("completed", "cancelled"));

    expect(error).toBeInstanceOf(PublicError);
    expect((error as PublicError).message).toBe('No se puede cambiar el estado de "completed" a "cancelled".');
  });

  it("no permite reabrir una cita cancelada", () => {
    expect(() => assertTransition("cancelled", "confirmed")).toThrow(PublicError);
  });
});

describe("construccion de items de cita (buildItemPayloads): validaciones de dominio", () => {
  it("sin servicios lanza PublicError", () => {
    const error = errorOf(() => buildItemPayloads(SALON, START, [], context));

    expect(error).toBeInstanceOf(PublicError);
    expect((error as PublicError).message).toBe("Selecciona al menos un servicio.");
  });

  it("un servicio de otro salon no se puede reservar", () => {
    const error = errorOf(() =>
      buildItemPayloads(SALON, START, [assignment({ service: { salon_id: OTHER_SALON } })], context)
    );

    expect((error as PublicError).message).toBe("El servicio no pertenece al salón.");
  });

  it("un servicio inactivo no se puede reservar", () => {
    const error = errorOf(() =>
      buildItemPayloads(SALON, START, [assignment({ service: { is_active: false } })], context)
    );

    expect((error as PublicError).message).toBe("El servicio no está activo.");
  });

  it("un profesional de otro salon no se puede asignar", () => {
    const error = errorOf(() =>
      buildItemPayloads(SALON, START, [assignment({ employee: { salon_id: OTHER_SALON } })], context)
    );

    expect((error as PublicError).message).toBe("El profesional no pertenece al salón.");
  });

  it("un profesional inactivo no se puede asignar", () => {
    const error = errorOf(() =>
      buildItemPayloads(SALON, START, [assignment({ employee: { is_active: false } })], context)
    );

    expect((error as PublicError).message).toBe("El profesional no está activo.");
  });

  it("un profesional que no realiza ese servicio se rechaza", () => {
    const error = errorOf(() =>
      buildItemPayloads(SALON, START, [assignment({ employee: { service_ids: ["otro"] } })], context)
    );

    expect((error as PublicError).message).toBe("El profesional seleccionado no realiza ese servicio.");
  });

  it("un profesional de otra categoria no atiende el servicio", () => {
    const error = errorOf(() =>
      buildItemPayloads(SALON, START, [assignment({ employee: { category_ids: ["otra"] } })], context)
    );

    expect((error as PublicError).message).toBe("El profesional seleccionado no atiende esa categoría.");
  });

  it("un hueco ocupado por otra cita se lanza como PublicError con el motivo de la violacion", () => {
    const busy: SchedulingContext = {
      ...context,
      getOccupiedSlots: () => [
        { start_time: "2026-06-01T14:50:00.000Z", end_time: "2026-06-01T16:00:00.000Z" },
      ],
    };

    const error = errorOf(() => buildItemPayloads(SALON, START, [assignment()], busy));

    expect(error).toBeInstanceOf(PublicError);
    expect((error as PublicError).message).toBe("El profesional ya tiene una cita en ese horario.");
  });
});
