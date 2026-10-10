import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canEditSchedule,
  isClosedStatus,
  isVisibleOnCalendar,
  REMINDABLE_APPOINTMENT_STATUSES,
  shouldBlockCalendar,
} from "./lifecycle";

// Catálogo completo de estados. Lista local: el catálogo interno no se exporta.
const APPOINTMENT_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;

describe("appointment lifecycle", () => {
  it("allows only valid status transitions", () => {
    expect(() => assertTransition("scheduled", "confirmed")).not.toThrow();
    expect(() => assertTransition("confirmed", "completed")).not.toThrow();
    expect(() => assertTransition("completed", "cancelled")).toThrow();
    expect(() => assertTransition("cancelled", "confirmed")).toThrow();
  });

  it("throws when an invalid transition is requested", () => {
    expect(() => assertTransition("completed", "confirmed")).toThrow(
      'No se puede cambiar el estado de "completed" a "confirmed".'
    );
  });

  it("only scheduled and confirmed appointments block the calendar", () => {
    expect(shouldBlockCalendar("scheduled")).toBe(true);
    expect(shouldBlockCalendar("confirmed")).toBe(true);
    expect(shouldBlockCalendar("completed")).toBe(false);
    expect(shouldBlockCalendar("cancelled")).toBe(false);
    expect(shouldBlockCalendar("no_show")).toBe(false);
  });
});

describe("visibilidad en calendario", () => {
  it("cubre los cinco estados: solo la cancelada queda oculta", () => {
    expect(isVisibleOnCalendar("scheduled")).toBe(true);
    expect(isVisibleOnCalendar("confirmed")).toBe(true);
    expect(isVisibleOnCalendar("completed")).toBe(true);
    expect(isVisibleOnCalendar("cancelled")).toBe(false);
    expect(isVisibleOnCalendar("no_show")).toBe(true);
  });
});

describe("catálogo de estados de cita", () => {
  it("cada estado es abierto o cerrado, sin solapes ni huecos", () => {
    for (const status of APPOINTMENT_STATUSES) {
      const closed = ["completed", "cancelled", "no_show"].includes(status);
      expect(isClosedStatus(status)).toBe(closed);
      expect(canEditSchedule(status)).toBe(!closed);
    }
  });

  it("solo completed, cancelled y no_show están cerrados", () => {
    expect(APPOINTMENT_STATUSES.filter((status) => isClosedStatus(status))).toEqual([
      "completed",
      "cancelled",
      "no_show",
    ]);
  });

  it("solo una cita abierta admite cambios de agenda", () => {
    for (const status of APPOINTMENT_STATUSES) {
      const open = status === "scheduled" || status === "confirmed";
      expect(canEditSchedule(status)).toBe(open);
    }
  });

  it("los recordatorios y el bloqueo de calendario usan los estados abiertos", () => {
    for (const status of APPOINTMENT_STATUSES) {
      const open = !isClosedStatus(status);
      expect(new Set<string>(REMINDABLE_APPOINTMENT_STATUSES).has(status)).toBe(open);
      expect(shouldBlockCalendar(status)).toBe(open);
    }
  });

  it("un estado desconocido no está cerrado y su agenda es editable", () => {
    expect(isClosedStatus("archived")).toBe(false);
    expect(canEditSchedule("archived")).toBe(true);
  });
});
