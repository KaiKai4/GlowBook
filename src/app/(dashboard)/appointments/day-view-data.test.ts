import { describe, expect, it } from "vitest";
import type { CalendarEmployee } from "@/features/appointments/view-models";
import { buildCalendarAppointment, buildEmployees, TEST_DATE } from "@/test/ui-appointments-fixtures";
import {
  filterAppointmentsByEmployee,
  filterEmployeesByName,
  summaryAppointments,
} from "./day-view-data";

describe("filterEmployeesByName", () => {
  const employees = buildEmployees();

  it("devuelve todos los profesionales cuando la búsqueda está vacía", () => {
    expect(filterEmployeesByName(employees, "")).toBe(employees);
  });

  it("busca por nombre completo sin distinguir mayúsculas", () => {
    expect(filterEmployeesByName(employees, "marta RUIZ")).toEqual([employees[1]]);
    expect(filterEmployeesByName(employees, "gómez")).toEqual([employees[0]]);
  });

  it("devuelve lista vacía cuando nadie coincide", () => {
    expect(filterEmployeesByName(employees, "zzz")).toEqual([]);
  });
});

describe("filterAppointmentsByEmployee", () => {
  // Reasigna el servicio de la cita base al profesional indicado.
  function assignedTo(id: string, employee: CalendarEmployee | null) {
    return buildCalendarAppointment({
      id,
      items: buildCalendarAppointment().items.map((item) => ({ ...item, employee })),
    });
  }

  it("conserva las citas con al menos un servicio del profesional", () => {
    const lucia: CalendarEmployee = { id: "emp-1", first_name: "Lucía", last_name: "Gómez" };
    const marta: CalendarEmployee = { id: "emp-2", first_name: "Marta", last_name: "Ruiz" };
    const result = filterAppointmentsByEmployee(
      [assignedTo("a", lucia), assignedTo("b", marta), assignedTo("c", null)],
      "emp-1"
    );
    expect(result.map((a) => a.id)).toEqual(["a"]);
  });
});

describe("summaryAppointments", () => {
  const at = (hhmm: string) => `${TEST_DATE}T${hhmm}:00-05:00`;

  it("filtra por estado según la pestaña del resumen", () => {
    const appts = [
      buildCalendarAppointment({ id: "s", status: "scheduled" }),
      buildCalendarAppointment({ id: "c", status: "confirmed" }),
      buildCalendarAppointment({ id: "d", status: "completed" }),
      buildCalendarAppointment({ id: "x", status: "cancelled" }),
    ];
    expect(summaryAppointments(appts, "upcoming").map((a) => a.id).sort()).toEqual(["c", "s"]);
    expect(summaryAppointments(appts, "completed").map((a) => a.id)).toEqual(["d"]);
    expect(summaryAppointments(appts, "cancelled").map((a) => a.id)).toEqual(["x"]);
    expect(summaryAppointments(appts, "no_show")).toEqual([]);
  });

  it("ordena por hora de inicio y, en empate, por id", () => {
    const appts = [
      buildCalendarAppointment({ id: "b", start_time: at("15:00") }),
      buildCalendarAppointment({ id: "z", start_time: at("09:00") }),
      buildCalendarAppointment({ id: "a", start_time: at("15:00") }),
    ];
    expect(summaryAppointments(appts, "upcoming").map((a) => a.id)).toEqual(["z", "a", "b"]);
  });

  it("ubica al final las citas sin hora de inicio", () => {
    const appts = [
      buildCalendarAppointment({ id: "sin", start_time: null }),
      buildCalendarAppointment({ id: "con", start_time: at("10:00") }),
    ];
    expect(summaryAppointments(appts, "upcoming").map((a) => a.id)).toEqual(["con", "sin"]);
  });

  it("no modifica el arreglo de entrada", () => {
    const appts = [
      buildCalendarAppointment({ id: "b", start_time: at("15:00") }),
      buildCalendarAppointment({ id: "a", start_time: at("09:00") }),
    ];
    summaryAppointments(appts, "upcoming");
    expect(appts.map((a) => a.id)).toEqual(["b", "a"]);
  });
});
